import React, { useMemo } from 'react';
import { useOrder } from '../context/OrderContext';
import { useProduct } from '../context/ProductContext';
import {
    DollarSign, CheckCircle, Clock, Receipt, TrendingUp, Calendar, Download,
    CreditCard, Smartphone, Banknote, AlertTriangle, Package
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './CashPage.css'; // Premium Styles

export default function CashPage() {
    const { pendingOrders } = useOrder();
    const { getPrice, exchangeRates, inventory, beerTypes, subtypes, getUnitsPerEmission, currencySymbol } = useProduct();

    // Helper to calculate total for an order
    const getOrderTotal = (items) => {
        return items.reduce((acc, item) => {
            const p = item.price || getPrice(item.beerType || item.name, item.emission, item.subtype, 'local');
            return acc + (p * item.quantity);
        }, 0);
    };

    const displayPayment = (method) => (method === 'Cash' || !method) ? 'Efectivo' : method;

    // --- ANALYTICS ---
    const {
        todayStats,
        todaysSales,
        paymentMethods,
        topProducts,
        lowStockConnect
    } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sales = [];
        let totalSales = 0;
        let closedCount = 0;
        let openCount = 0;

        const methodCounts = { 'Efectivo': 0, 'Zelle': 0, 'Pago Movil': 0, 'Punto': 0, 'Otro': 0 };
        const productCounts = {};

        pendingOrders.forEach(order => {
            if (order.status === 'OPEN') {
                openCount++;
            } else if (order.status === 'PAID') {
                const closedDate = new Date(order.closedAt || order.createdAt);
                closedDate.setHours(0, 0, 0, 0);

                if (closedDate.getTime() === today.getTime()) {
                    // Use stored total if available (New Logic), otherwise fallback to recalc (Legacy)
                    const total = (order.totalAmountUsd !== undefined && order.totalAmountUsd !== null)
                        ? Number(order.totalAmountUsd)
                        : getOrderTotal(order.items);

                    sales.push({ ...order, total });
                    totalSales += total;
                    closedCount++;

                    // Payment Stats
                    const method = displayPayment(order.paymentMethod);
                    if (methodCounts[method] !== undefined) methodCounts[method] += total;
                    else methodCounts['Otro'] += total;

                    // Product Stats - Aggregated by Equivalent Units
                    order.items.forEach(item => {
                        const name = item.beerType || item.name;
                        const emission = item.emission || 'Unidad';
                        const subtype = item.subtype || 'Botella';

                        // Calculate equivalent units
                        const unitsPerPack = getUnitsPerEmission ? (getUnitsPerEmission(emission, subtype) || 1) : 1;
                        const totalUnits = (item.quantity || 1) * unitsPerPack;

                        if (!productCounts[name]) productCounts[name] = 0;
                        productCounts[name] += totalUnits;
                    });
                }
            }
        });

        // Top Products
        const sortedProducts = Object.entries(productCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Low Stock (Threshold < 12 units)
        const alerts = [];
        if (inventory && beerTypes && subtypes) {
            beerTypes.forEach(beer => {
                subtypes.forEach(sub => {
                    const key = `${beer}_${sub}`;
                    const qty = inventory[key] || 0;
                    if (qty < 12 && qty > 0) {
                        alerts.push({ name: beer, subtype: sub, qty });
                    }
                });
            });
        }

        sales.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));

        return {
            todayStats: { totalSales, closedCount, openCount, avgTicket: closedCount ? totalSales / closedCount : 0 },
            todaysSales: sales,
            paymentMethods: methodCounts,
            topProducts: sortedProducts,
            lowStockConnect: alerts.slice(0, 5)
        };
    }, [pendingOrders, getPrice, inventory, beerTypes, subtypes, getUnitsPerEmission]);

    // Export Function
    const handleExport = () => {
        if (todaysSales.length === 0) {
            alert("No hay ventas para exportar hoy.");
            return;
        }

        const rate = exchangeRates.bcv || 0;

        const summaryData = todaysSales.map(sale => ({
            'Ticket': sale.ticketNumber,
            'Cliente': sale.customerName,
            'Hora': new Date(sale.closedAt).toLocaleTimeString(),
            'Pago': displayPayment(sale.paymentMethod),
            'Ref': sale.reference || '',
            [`Total (${currencySymbol})`]: parseFloat(sale.total.toFixed(2)),
            'Total (Bs)': parseFloat((sale.total * rate).toFixed(2)),
        }));

        const ws = XLSX.utils.json_to_sheet(summaryData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte_Diario");
        const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
        XLSX.writeFile(wb, `Caja_${dateStr}.xlsx`);
    };

    const rate = exchangeRates.bcv || 0;
    const totalSalesBs = todayStats.totalSales * rate;

    // --- CHART LOGIC ---
    const getDonutGradient = () => {
        if (todayStats.totalSales === 0) return 'conic-gradient(#333 0% 100%)';

        const colors = { 'Efectivo': '#34d399', 'Pago Movil': '#3b82f6', 'Zelle': '#8b5cf6', 'Punto': '#f59e0b', 'Otro': '#6b7280' };
        let gradientStr = '';
        let currentDeg = 0;

        Object.entries(paymentMethods).forEach(([key, val]) => {
            if (val > 0) {
                const percent = (val / todayStats.totalSales) * 100;
                const endDeg = currentDeg + percent;
                gradientStr += `${colors[key] || '#ccc'} ${currentDeg}% ${endDeg}%, `;
                currentDeg = endDeg;
            }
        });

        return `conic-gradient(${gradientStr.slice(0, -2)})`;
    };

    return (
        <div className="page-container">
            <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="text-3xl font-bold text-primary">Panel Financiero</h1>
                    <p className="text-secondary">Resumen de operaciones del día</p>
                </div>
                <button
                    onClick={handleExport}
                    className="action-btn"
                    style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', height: 'fit-content' }}
                >
                    <Download size={18} />
                    <span>Excel</span>
                </button>
            </header>

            {/* TOP ROW: Hero + KPI */}
            <div className="dashboard-grid">
                {/* Hero Sales Card */}
                <div className="dashboard-card card-hero col-span-4">
                    <div>
                        <div className="label">Ventas Totales Hoy</div>
                        <div className="value">{currencySymbol}{todayStats.totalSales.toFixed(2)}</div>
                        <div className="sub-value">
                            Bs {totalSalesBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.9 }}>
                        <TrendingUp size={20} />
                        <span>Resumen Diario</span>
                    </div>
                    {/* Decorative Blob */}
                    <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
                </div>

                {/* Operations Status */}
                <div className="dashboard-card col-span-4">
                    <h2 className="card-title">Estado Operativo <Clock size={18} className="text-secondary" /></h2>
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '100%' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#F59E0B' }}>{todayStats.openCount}</div>
                            <div className="stat-label">Abiertos</div>
                        </div>
                        <div style={{ width: '1px', height: '40px', background: 'var(--bg-card-hover)' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#3B82F6' }}>{todayStats.closedCount}</div>
                            <div className="stat-label">Cerrados</div>
                        </div>
                    </div>
                </div>

                {/* Avg Ticket */}
                <div className="dashboard-card col-span-4">
                    <h2 className="card-title">Ticket Promedio <Receipt size={18} className="text-secondary" /></h2>
                    <div className="stat-value" style={{ color: '#A78BFA' }}>
                        {currencySymbol}{todayStats.avgTicket.toFixed(2)}
                    </div>
                    <div className="stat-label">Por transacción cerrada</div>
                </div>
            </div>

            {/* MID ROW: Charts & Lists */}
            <div className="dashboard-grid">
                {/* Payment Methods (Donut) */}
                <div className="dashboard-card col-span-4">
                    <h2 className="card-title">Métodos de Pago</h2>
                    <div className="donut-chart-container" style={{ background: getDonutGradient() }}>
                        <div className="donut-inner">
                            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{currencySymbol}{todayStats.totalSales.toFixed(0)}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Total</span>
                        </div>
                    </div>
                    <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {Object.entries(paymentMethods).map(([key, val]) => (
                            val > 0 && (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: key === 'Efectivo' ? '#34d399' : key === 'Pago Movil' ? '#3b82f6' : key === 'Zelle' ? '#8b5cf6' : '#f59e0b' }} />
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{key}</span>
                                </div>
                            )
                        ))}
                    </div>
                </div>

                {/* Top Products */}
                <div className="dashboard-card col-span-4">
                    <h2 className="card-title">Top Productos <Package size={18} className="text-secondary" /></h2>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {topProducts.length === 0 ? <span className="text-secondary text-sm">Sin datos aún</span> :
                            topProducts.map((p, i) => (
                                <div key={i} className="top-product-item">
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <div className="rank-badge">{i + 1}</div>
                                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{p.name}</span>
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.count}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>

                {/* Low Stock Alerts */}
                <div className="dashboard-card col-span-4">
                    <h2 className="card-title" style={{ color: '#EF4444' }}>Stock Crítico <AlertTriangle size={18} /></h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: '200px' }}>
                        {lowStockConnect.length === 0 ? <span className="text-secondary text-sm">Inventario Saludable</span> :
                            lowStockConnect.map((alert, i) => (
                                <div key={i} style={{
                                    background: 'rgba(239, 68, 68, 0.05)',
                                    padding: '10px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(239, 68, 68, 0.1)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{alert.name}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{alert.subtype}</div>
                                    </div>
                                    <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '0.85rem' }}>{alert.qty}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            {/* Recent History (Bottom) */}
            <div className="dashboard-card col-span-12">
                <h2 className="card-title">Transacciones Recientes</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {todaysSales.slice(0, 5).map(sale => (
                        <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--bg-card-hover)' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ background: 'var(--bg-app)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    {sale.ticketNumber.toString().slice(-2)}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sale.customerName}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{displayPayment(sale.paymentMethod)}</span>
                                </div>
                            </div>
                            <span style={{ fontWeight: 700, color: '#34d399' }}>{currencySymbol}{sale.total.toFixed(2)}</span>
                        </div>
                    ))}
                    {todaysSales.length === 0 && <span className="text-secondary text-sm">Sin transacciones hoy</span>}
                </div>
            </div>

        </div>
    );
}
