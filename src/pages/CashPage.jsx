import React, { useMemo, useState, useEffect } from 'react';
import { useOrder } from '../context/OrderContext';
import { useProduct } from '../context/ProductContext';
import { useNotification } from '../context/NotificationContext';
import {
    DollarSign, CheckCircle, Clock, Receipt, TrendingUp, Calendar, Download,
    CreditCard, Smartphone, Banknote, AlertTriangle, Package, Activity, AlertCircle, ShoppingBag, ChevronDown, ChevronUp, User, Maximize2, X, ChevronLeft, ChevronRight, Share2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './CashPage.css'; // Premium Styles

export default function CashPage() {
    const { pendingOrders } = useOrder();
    const { getPrice, exchangeRates, inventory, beerTypes, subtypes, getUnitsPerEmission, currencySymbol } = useProduct();
    const { showNotification } = useNotification();
    const [showReportModal, setShowReportModal] = useState(false);
    const [showWeeklyModal, setShowWeeklyModal] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (showReportModal || showWeeklyModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showReportModal, showWeeklyModal]);

    // Helper to calculate total for an order
    const getOrderTotal = (items) => {
        return items.reduce((acc, item) => {
            const p = item.price || getPrice(item.beerType || item.name, item.emission, item.subtype, 'local');
            return acc + (p * item.quantity);
        }, 0);
    };

    const displayPayment = (method) => {
        if (!method || method === 'Cash') return 'Efectivo';
        if (typeof method === 'string' && method.startsWith('Pre-Pagado - ')) {
            const subMethod = method.replace('Pre-Pagado - ', '');
            return subMethod;
        }
        return method;
    };

    const getShortPayment = (method) => {
        const full = displayPayment(method);
        if (full.includes('Efectivo')) return 'EF';
        if (full.includes('Pago Móvil') || full.includes('Pago Movil')) return 'PM';
        if (full.includes('Bio Pago') || full.includes('BioPago')) return 'BP';
        if (full.includes('Punto')) return 'PU';
        return full.substring(0, 2).toUpperCase();
    };

    // --- ANALYTICS ---
    const {
        todayStats,
        todaysSales,
        paymentMethods,
        topProducts,
        lowStockConnect,
        weeklyStats
    } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sales = [];
        let totalSales = 0;
        let closedCount = 0;
        let openCount = 0;

        const methodCounts = { 'Efectivo': 0, 'Pago Móvil': 0, 'Punto': 0, 'Bio Pago': 0 };
        const productCounts = {};

        pendingOrders.forEach(order => {
            if (order.status === 'OPEN') {
                openCount++;
            } else if (order.status === 'PAID') {
                const closedDate = new Date(order.closedAt || order.createdAt);
                closedDate.setHours(0, 0, 0, 0);

                const isToday = closedDate.getTime() === today.getTime();
                const isRecent = closedDate.getTime() >= (today.getTime() - 60 * 24 * 60 * 60 * 1000);

                if (isRecent) {
                    // Use stored total if available (New Logic), otherwise fallback to recalc (Legacy)
                    const total = (order.totalAmountUsd !== undefined && order.totalAmountUsd !== null)
                        ? Number(order.totalAmountUsd)
                        : getOrderTotal(order.items);

                    sales.push({ ...order, total });

                    if (isToday) {
                        totalSales += total;
                        closedCount++;

                        // Payment Stats - ONLY FOR TODAY to ensure 100% donut
                        let method = order.paymentMethod || 'Efectivo';

                        // Normalize names
                        if (method === 'Pago Movil') method = 'Pago Móvil';
                        if (method === 'BioPago') method = 'Bio Pago';
                        if (method === 'Punto' || method === 'Bio Pago' || method === 'Efectivo' || method === 'Pago Móvil') {
                            // Valid
                        } else {
                            method = 'Punto'; // Fallback
                        }

                        if (methodCounts.hasOwnProperty(method)) {
                            methodCounts[method] += total;
                        } else {
                            methodCounts['Punto'] += total;
                        }
                    }

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

        // Productos por Agotarse (Threshold <= 5 boxes)
        const alerts = [];
        if (inventory && beerTypes && subtypes) {
            beerTypes.forEach(beer => {
                subtypes.forEach(sub => {
                    const key = `${beer}_${sub}`;
                    const qty = inventory[key] || 0;
                    const unitsPerBox = getUnitsPerEmission('Caja', sub) || 36;
                    const threshold = 5 * unitsPerBox;

                    if (qty <= threshold) {
                        alerts.push({ name: beer, subtype: sub, qty, boxes: qty / unitsPerBox });
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
            lowStockConnect: alerts.slice(0, 5),
            weeklyStats: (() => {
                const now = new Date();
                const day = now.getDay(); // 0 (Sun) - 6 (Sat)
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
                const monday = new Date(now.setDate(diff));
                monday.setHours(0, 0, 0, 0);

                const weekData = Array(7).fill(0);
                const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

                pendingOrders.forEach(o => {
                    if (o.status === 'PAID') {
                        const d = new Date(o.closedAt || o.createdAt);
                        if (d >= monday) {
                            let dIndex = d.getDay(); // 0=Sun, 1=Mon
                            // Convert to 0=Mon, 6=Sun
                            let chartIndex = dIndex === 0 ? 6 : dIndex - 1;

                            const total = (o.totalAmountUsd !== undefined && o.totalAmountUsd !== null)
                                ? Number(o.totalAmountUsd)
                                : getOrderTotal(o.items || []);

                            if (chartIndex >= 0 && chartIndex < 7) {
                                weekData[chartIndex] += total;
                            }
                        }
                    }
                });

                const maxVal = Math.max(...weekData, 1); // Avoid div by 0
                const currentDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

                return {
                    data: weekData,
                    labels: days,
                    maxVal,
                    currentDayIndex,
                    getWeekData: (offset) => {
                        const targetMonday = new Date();
                        const targetDayNum = targetMonday.getDay() || 7;
                        targetMonday.setDate(targetMonday.getDate() - (targetDayNum - 1) - (offset * 7));
                        targetMonday.setHours(0, 0, 0, 0);

                        const weekTotalData = Array(7).fill(0);
                        const mondayTime = targetMonday.getTime();
                        const sundayTime = mondayTime + (7 * 24 * 60 * 60 * 1000);

                        pendingOrders.forEach(o => {
                            if (o.status === 'PAID') {
                                const d = new Date(o.closedAt || o.createdAt);
                                const t = d.getTime();
                                if (t >= mondayTime && t < sundayTime) {
                                    const dIdx = d.getDay();
                                    const cIdx = dIdx === 0 ? 6 : dIdx - 1;
                                    const val = (o.totalAmountUsd !== undefined && o.totalAmountUsd !== null)
                                        ? Number(o.totalAmountUsd)
                                        : getOrderTotal(o.items || []);
                                    weekTotalData[cIdx] += val;
                                }
                            }
                        });

                        return {
                            data: weekTotalData,
                            total: weekTotalData.reduce((a, b) => a + b, 0),
                            max: Math.max(...weekTotalData, 0),
                            start: targetMonday,
                            end: new Date(mondayTime + (6 * 24 * 60 * 60 * 1000))
                        };
                    },
                    historicalWeeks: (() => {
                        // Calculate last 4 weeks totals
                        const weeks = {}; // key: timestamp

                        pendingOrders.forEach(o => {
                            if (o.status === 'PAID') {
                                const d = new Date(o.closedAt || o.createdAt);
                                // Get Monday of the week
                                const day = d.getDay() || 7; // 1=Mon, 7=Sun
                                const mondayDate = new Date(d);
                                if (day !== 1) mondayDate.setDate(d.getDate() - (day - 1));
                                mondayDate.setHours(0, 0, 0, 0);
                                const key = mondayDate.getTime();

                                const totalValue = (o.totalAmountUsd !== undefined && o.totalAmountUsd !== null)
                                    ? Number(o.totalAmountUsd)
                                    : getOrderTotal(o.items || []);

                                weeks[key] = (weeks[key] || 0) + totalValue;
                            }
                        });

                        // Get last 4 mondays
                        const currentNow = new Date();
                        const currentDayNum = currentNow.getDay() || 7;
                        const currentMonday = new Date(currentNow);
                        currentMonday.setHours(0, 0, 0, 0);
                        currentMonday.setDate(currentNow.getDate() - (currentDayNum - 1));

                        const histResult = [];
                        for (let i = 0; i < 4; i++) {
                            const loopMonday = new Date(currentMonday);
                            loopMonday.setDate(currentMonday.getDate() - (i * 7));
                            const timestamp = loopMonday.getTime();
                            const total = weeks[timestamp] || 0;
                            histResult.push({
                                label: i === 0 ? 'Esta Semana' : i === 1 ? 'Semana Pasada' : `Hace ${i} semanas`,
                                total,
                                date: loopMonday.toLocaleDateString()
                            });
                        }
                        return histResult.reverse(); // Oldest first for chart
                    })()
                };
            })()
        };
    }, [pendingOrders, getPrice, inventory, beerTypes, subtypes, getUnitsPerEmission]);

    // Export Function
    const handleExport = () => {
        if (todaysSales.length === 0) {
            alert("No hay ventas para exportar hoy.");
            return;
        }

        const rate = exchangeRates.bcv || 0;

        const summaryData = todaysSales.map(sale => {
            // 1. Detailed Consumption Logic
            const consumptionMap = {};

            sale.items.forEach(item => {
                const name = item.beerType || item.name;
                const emission = item.emission || 'Unidad';
                const qty = item.quantity || 1;

                // Aggregate Consumption
                const detailKey = `${name} - ${emission}`;
                if (!consumptionMap[detailKey]) consumptionMap[detailKey] = 0;
                consumptionMap[detailKey] += qty;
            });

            const consumptionStr = Object.entries(consumptionMap)
                .filter(([_, v]) => v > 0) // Filter out any 0s just in case
                .map(([k, v]) => `${v} ${k}`)
                .join(', ');

            return {
                'Ticket': sale.ticketNumber,
                'Cliente': sale.customerName,
                'Fecha': new Date(sale.closedAt).toLocaleDateString(), // Added Date
                'Hora': new Date(sale.closedAt).toLocaleTimeString(),
                'Pago': displayPayment(sale.paymentMethod),
                'Ref': (sale.paymentMethod && sale.paymentMethod.toString().toLowerCase().includes('pago móvil')) ? (sale.reference || '') : 'No Aplica', // Logic update
                'Detalle Consumo': consumptionStr,
                'Usuario': sale.createdBy || 'Desconocido',
                [`Total (${currencySymbol})`]: parseFloat(sale.total.toFixed(2)),
                'Total (Bs)': parseFloat((sale.total * rate).toFixed(2)),
            };
        });

        const ws = XLSX.utils.json_to_sheet(summaryData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte_Diario");
        const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
        XLSX.writeFile(wb, `Caja_${dateStr}.xlsx`);
    };

    const handleShareSale = (sale) => {
        const rate = exchangeRates.bcv || 0;
        const dateStr = new Date(sale.closedAt).toLocaleDateString();
        const timeStr = new Date(sale.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const itemsStr = sale.items.map(item => {
            const qty = item.quantity || 1;
            const name = item.beerType || item.name;
            const emission = item.emission || 'Unidad';
            return `• ${qty} ${name} (${emission})`;
        }).join('\n');

        const message = `*Reporte de Pago - Licorería*\n\n` +
            `*Cliente:* ${sale.customerName}\n` +
            `*Ticket:* #${sale.ticketNumber}\n` +
            `*Fecha:* ${dateStr} ${timeStr}\n` +
            `*Pago:* ${displayPayment(sale.paymentMethod)}\n\n` +
            `*Consumo:*\n${itemsStr}\n\n` +
            `*Total:* $${sale.total.toFixed(2)}\n` +
            `*Total Bs:* ${(sale.total * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
            `¡Gracias por su preferencia!`;

        const copyToClipboard = (text) => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers or insecure contexts
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    return Promise.resolve();
                } catch (err) {
                    document.body.removeChild(textArea);
                    return Promise.reject(err);
                }
            }
        };

        copyToClipboard(message)
            .then(() => {
                showNotification('Reporte Copiado Exitosamente', 'success', 1200);
            })
            .catch(err => {
                console.error('Error copying to clipboard:', err);
                showNotification('Error al copiar el reporte', 'error', 2000);
            });
    };

    const rate = exchangeRates.bcv || 0;
    const totalSalesBs = todayStats.totalSales * rate;

    // --- REUSABLE CHART COMPONENT ---
    const WeeklyChart = ({ onClick }) => {
        const compactLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

        return (
            <div
                className="dashboard-card weekly-chart-card"
                style={{ height: '100%', cursor: 'pointer' }}
                onClick={onClick}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Semana Actual</h3>
                    <Calendar size={16} className="text-secondary" />
                </div>

                <div className="chart-container">
                    {weeklyStats.data.map((val, idx) => {
                        // Calculate max from non-zero values only
                        const nonZeroValues = weeklyStats.data.filter(v => v > 0);
                        const effectiveMax = nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 1;
                        const height = (val / effectiveMax) * 100; // % height
                        const isActive = idx === weeklyStats.currentDayIndex;
                        return (
                            <div key={idx} className="chart-bar-wrapper">
                                <div
                                    className={`chart-bar ${isActive ? 'bar-active' : ''}`}
                                    style={{ height: `${Math.max(height, 8)}%`, opacity: (val === 0 && !isActive) ? 0.2 : 1 }}
                                    data-value={`$${val.toFixed(0)}`}
                                />
                                <span className="bar-label" style={{ fontWeight: isActive ? '800' : '600' }}>
                                    {compactLabels[idx]}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    };

    // --- CHART LOGIC ---

    return (
        <div className="page-container">
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 className="text-3xl font-bold text-primary">Panel Financiero</h1>
                </div>
            </header>

            <div className="dashboard-main-container">
                {/* TOP ROW SECTION */}
                <div className="hero-container">
                    <div className="dashboard-card card-hero" style={{ height: '100%', background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)', color: 'white', border: 'none' }}>
                        <div>
                            <div className="label" style={{ color: 'rgba(255,255,255,0.9)' }}>Ventas Totales de Hoy</div>
                            <div className="value" style={{ color: 'white' }}>{currencySymbol}{todayStats.totalSales.toFixed(2)}</div>
                            <div className="sub-value" style={{ color: 'rgba(255,255,255,0.8)' }}>
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
                </div>

                <div className="chart-container-wrapper">
                    <WeeklyChart onClick={() => setShowWeeklyModal(true)} />
                </div>

                {/* TABLE SECTION */}
                <div className="table-section-wrapper">
                    <div className="recent-transactions-section" style={{ marginBottom: 0 }}>
                        <div className="table-container-dark">
                            <div className="table-title-bar">
                                <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Tabla de Ventas</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.9 }}>Últimos 60 Días</span>
                            </div>
                            {/* Table Header */}
                            <div className="table-header-row">
                                <div className="th-cell">Cliente</div>
                                <div className="th-cell">Fecha</div>
                                <div className="th-cell">Pago</div>
                                <div className="th-cell consumption-cell" style={{ flex: 2 }}>
                                    <span className="desktop-header">Detalle de Consumo</span>
                                    <span className="mobile-header">Consumo</span>
                                </div>
                                <div className="th-cell user-header">Usuario</div>
                            </div>

                            {/* Table Body */}
                            <div className="table-body-scroll">
                                {todaysSales.length > 0 ? (
                                    todaysSales.map((sale) => (
                                        <div key={sale.id} className="table-row">
                                            <div className="td-cell">
                                                <div className="customer-name" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sale.customerName}</div>
                                                <div className="ticket-number" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>#{sale.ticketNumber}</div>
                                            </div>
                                            <div className="td-cell date-cell">
                                                <div className="date-text">{new Date(sale.closedAt).toLocaleDateString()}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(sale.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                            <div className="td-cell">
                                                <span className="badge-payment">
                                                    <span className="long-method">{displayPayment(sale.paymentMethod)}</span>
                                                    <span className="short-method">{getShortPayment(sale.paymentMethod)}</span>
                                                </span>
                                            </div>
                                            <div className="td-cell consumption-cell" style={{ flex: 2 }}>
                                                {sale.items.map(item => {
                                                    const qty = item.quantity || 1;
                                                    const name = item.beerType || item.name;
                                                    const emission = item.emission || 'Unidad';
                                                    return `${qty} ${name} (${emission})`;
                                                }).join(', ')}
                                            </div>
                                            <div className="td-cell user-cell">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div className="user-icon-container" style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <User size={14} color="white" />
                                                    </div>
                                                    <span className="user-name">{sale.createdBy || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No hay ventas registradas hoy.
                                    </div>
                                )}
                            </div>

                            {/* Table Footer */}
                            <div className="table-footer">
                                <div className="footer-info">
                                    <AlertCircle size={16} />
                                    <span>Descarga el Excel para ver un reporte completo</span>
                                </div>
                                <button
                                    onClick={handleExport}
                                    className="action-btn"
                                    style={{
                                        padding: '0.5rem 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.9rem',
                                        background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                                        color: 'white',
                                        border: 'none'
                                    }}
                                >
                                    <Download size={18} />
                                    <span>Excel</span>
                                </button>
                                <button
                                    className="action-btn"
                                    style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onClick={() => setShowReportModal(true)}
                                >
                                    <Maximize2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM ANALYTICS SECTION */}
                <div className="analytics-grid-wrapper">
                    <div className="dashboard-grid" style={{ marginBottom: 0 }}>
                        {/* Productos por Agotarse */}
                        <div className="dashboard-card col-span-6">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#EF4444', margin: 0 }}>Productos por Agotarse</h3>
                                <AlertTriangle size={18} style={{ color: '#EF4444' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: '180px', paddingRight: '4px' }} className="custom-scrollbar">
                                {lowStockConnect.length === 0 ? (
                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
                                        Inventario Saludable
                                    </div>
                                ) : (
                                    lowStockConnect.map((alert, i) => (
                                        <div key={i} style={{
                                            background: 'rgba(239, 68, 68, 0.05)',
                                            padding: '10px 14px',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(239, 68, 68, 0.1)',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{alert.name}</div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.7, color: 'var(--text-secondary)' }}>{alert.subtype}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ color: '#EF4444', fontWeight: 800, fontSize: '0.9rem' }}>
                                                    {alert.boxes.toFixed(1)} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>Cajas</span>
                                                </div>
                                                <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{alert.qty} Uds</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Top Products */}
                        <div className="dashboard-card col-span-6">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Top Productos</h3>
                                <Package size={18} className="text-secondary" />
                            </div>
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

                        {/* Payment Methods (Enhanced Donut) */}
                        <div className="dashboard-card col-span-6 payment-methods-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Métodos de Pago</h3>
                                <CreditCard size={18} className="text-secondary" />
                            </div>

                            <div className="donut-visualization-container">
                                <svg viewBox="0 0 500 400" className="donut-svg">
                                    {/* Donut Segments */}
                                    {(() => {
                                        const radius = 95;
                                        const cx = 250;
                                        const cy = 200;
                                        const strokeWidth = 35;
                                        const total = todayStats.totalSales || 1;
                                        let cumulativeAngle = -90;

                                        const colors = {
                                            'Efectivo': '#34d399',
                                            'Pago Móvil': '#3b82f6',
                                            'Punto': '#f59e0b',
                                            'Bio Pago': '#f97316'
                                        };

                                        return Object.entries(paymentMethods).map(([key, val], idx) => {
                                            if (val <= 0) return null;
                                            const percentage = (val / total);
                                            const angle = percentage * 360;

                                            // Calculate path for donut segment
                                            const startAngle = cumulativeAngle;
                                            const endAngle = cumulativeAngle + angle;
                                            cumulativeAngle += angle;

                                            const startRad = (startAngle * Math.PI) / 180;
                                            const endRad = (endAngle * Math.PI) / 180;

                                            const x1 = cx + radius * Math.cos(startRad);
                                            const y1 = cy + radius * Math.sin(startRad);
                                            const x2 = cx + radius * Math.cos(endRad);
                                            const y2 = cy + radius * Math.sin(endRad);

                                            const largeArcFlag = angle > 180 ? 1 : 0;
                                            const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

                                            // Label positioning
                                            const midAngle = startAngle + angle / 2;
                                            const midRad = (midAngle * Math.PI) / 180;
                                            const labelDistance = 140;
                                            const lx = cx + labelDistance * Math.cos(midRad);
                                            const ly = cy + labelDistance * Math.sin(midRad);

                                            // Callout line end
                                            const isLeft = lx < cx;
                                            const targetX = isLeft ? lx - 45 : lx + 45;

                                            return (
                                                <g key={key}>
                                                    <path
                                                        d={d}
                                                        fill="none"
                                                        stroke={colors[key] || '#ccc'}
                                                        strokeWidth={strokeWidth}
                                                        strokeLinecap="round"
                                                        className="donut-segment"
                                                    />
                                                    {/* Callout Line */}
                                                    <path
                                                        d={`M ${cx + (radius + 20) * Math.cos(midRad)} ${cy + (radius + 20) * Math.sin(midRad)} L ${lx} ${ly} L ${targetX} ${ly}`}
                                                        fill="none"
                                                        stroke={colors[key]}
                                                        strokeWidth="2"
                                                        strokeOpacity="0.8"
                                                    />
                                                    {/* Percentage Label */}
                                                    <text
                                                        x={targetX + (isLeft ? -8 : 8)}
                                                        y={ly}
                                                        dominantBaseline="middle"
                                                        textAnchor={isLeft ? 'end' : 'start'}
                                                        fill={colors[key]}
                                                        style={{ fontSize: '18px', fontWeight: 900 }}
                                                    >
                                                        {(percentage * 100).toFixed(1)}%
                                                    </text>
                                                </g>
                                            );
                                        });
                                    })()}

                                    {/* Center Text */}
                                    <g transform="translate(250, 200)">
                                        <text textAnchor="middle" y="-10" fill="var(--text-primary)" style={{ fontSize: '32px', fontWeight: 900 }}>
                                            {currencySymbol}{todayStats.totalSales.toFixed(0)}
                                        </text>
                                        <text textAnchor="middle" y="20" fill="var(--text-secondary)" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>
                                            Total Hoy
                                        </text>
                                    </g>
                                </svg>
                            </div>

                            <div className="donut-legend-grid">
                                {Object.entries(paymentMethods).map(([key, val]) => (
                                    <div key={key} className="legend-item">
                                        <div className="legend-dot" style={{ background: key === 'Efectivo' ? '#34d399' : key === 'Pago Móvil' ? '#3b82f6' : key === 'Punto' ? '#f59e0b' : '#f97316' }} />
                                        <span>{key}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Full Report Modal */}
            {showReportModal && (
                <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
                    <div className="report-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="report-modal-header">
                            <div>
                                <h3 className="text-xl font-bold text-primary">Reportes Detallados</h3>
                            </div>
                            <button className="close-btn" onClick={() => setShowReportModal(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="report-modal-body">
                            {todaysSales.map(sale => {
                                const method = sale.paymentMethod || 'Efectivo';
                                const methodColor = method === 'Efectivo' ? '#10b981' : method === 'Pago Móvil' ? '#3b82f6' : method === 'Punto' ? '#f59e0b' : '#f43f5e';

                                return (
                                    <div key={sale.id} className="mobile-report-card">
                                        {/* Header: Customer & Payment */}
                                        <div className="mobile-report-row">
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                                                    {sale.customerName}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                    {new Date(sale.closedAt).toLocaleDateString()} • {new Date(sale.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • #{sale.ticketNumber}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="payment-badge-pill" style={{ background: `${methodColor}15`, color: methodColor }}>
                                                    {displayPayment(method)}
                                                </div>
                                                <button
                                                    className="share-report-btn"
                                                    onClick={() => handleShareSale(sale)}
                                                    style={{
                                                        background: 'var(--card-bg)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '8px',
                                                        padding: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--text-secondary)',
                                                        transition: 'all 0.2s',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Share2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Consumption Items */}
                                        <div className="report-consumption-box">
                                            {sale.items.map((item, idx) => {
                                                const qty = item.quantity || 1;
                                                const name = item.beerType || item.name;
                                                const emission = item.emission || 'Unidad';
                                                return (
                                                    <div key={idx} className="consumption-item">
                                                        <div className="consumption-dot" style={{ background: methodColor }} />
                                                        <span>{qty} {name} <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>({emission})</span></span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Footer: User & Totals */}
                                        <div className="report-footer-info">
                                            <div className="sale-user-tag">
                                                <User size={14} />
                                                <span>{sale.createdBy || 'N/A'}</span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                                                    {currencySymbol}{sale.total.toFixed(2)}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', opacity: 0.8 }}>
                                                    Bs {(sale.total * rate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {todaysSales.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                    No hay ventas registradas.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Weekly Report Modal */}
            {
                showWeeklyModal && (() => {
                    const selectedWeek = weeklyStats.getWeekData(weekOffset);
                    const formatDate = (date) => date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

                    return (
                        <div className="report-modal-overlay" onClick={() => { setShowWeeklyModal(false); setWeekOffset(0); }}>
                            <div className="report-modal-content weekly-modal-content" onClick={e => e.stopPropagation()}>
                                <div className="report-modal-header weekly-modal-header">
                                    <div className="weekly-header-top">
                                        <h2 className="weekly-title">
                                            {weekOffset === 0 ? 'Esta Semana' : weekOffset === 1 ? 'Semana Pasada' : `Hace ${weekOffset} semanas`}
                                        </h2>
                                        <button className="close-btn" onClick={() => { setShowWeeklyModal(false); setWeekOffset(0); }}>
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="weekly-nav-section">
                                        <button
                                            className="nav-btn"
                                            onClick={() => setWeekOffset(prev => prev + 1)}
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <p className="weekly-range">
                                            {formatDate(selectedWeek.start)} - {formatDate(selectedWeek.end)}
                                        </p>
                                        <button
                                            className="nav-btn"
                                            onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
                                            disabled={weekOffset === 0}
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="report-modal-body">
                                    {/* Hero Highlights */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                        <div className="dashboard-card" style={{ background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)', color: 'white', border: 'none', padding: '1rem' }}>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Total Ventas</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                                                {currencySymbol}{selectedWeek.total.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 600 }}>
                                                Bs {(selectedWeek.total * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '2px' }}>
                                                {weekOffset === 0 ? 'Semana Actual' : 'Semana Seleccionada'}
                                            </div>
                                        </div>
                                        <div className="dashboard-card" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', padding: '1rem' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Máximo Diario</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80' }}>
                                                {currencySymbol}{selectedWeek.max.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600, opacity: 0.9 }}>
                                                Bs {(selectedWeek.max * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                Mejor venta de esta semana
                                            </div>
                                        </div>
                                    </div>

                                    {/* 7-Day Chart for Selected Week */}
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Desempeño Diario</h3>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', padding: '0 10px', marginBottom: '2.5rem' }}>
                                        {selectedWeek.data.map((val, idx) => {
                                            const h = (val / (selectedWeek.max || 1)) * 100;
                                            const isPeak = val === selectedWeek.max && val > 0;
                                            return (
                                                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ position: 'relative', width: '24px', height: '100px', display: 'flex', alignItems: 'flex-end' }}>
                                                        <div
                                                            style={{
                                                                width: '100%',
                                                                height: `${Math.max(h, 5)}%`,
                                                                background: isPeak ? '#fb923c' : 'rgba(0,0,0,0.15)',
                                                                borderRadius: '12px',
                                                                transition: 'height 0.3s ease',
                                                                boxShadow: isPeak ? '0 0 15px rgba(251, 146, 60, 0.4)' : 'none'
                                                            }}
                                                        >
                                                            {val > 0 && (
                                                                <div style={{ position: 'absolute', top: '-25px', width: '100%', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: isPeak ? '#fb923c' : 'var(--text-secondary)' }}>
                                                                    {val > 999 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isPeak ? '#f97316' : 'var(--text-secondary)' }}>
                                                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'][idx]}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Daily Breakdown */}
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Listado de Ventas</h3>
                                    <div className="weekly-breakdown-list" style={{ border: 'none', background: 'transparent' }}>
                                        {selectedWeek.data.map((total, idx) => {
                                            const dayName = weeklyStats.labels[idx];
                                            if (total === 0) return null;
                                            return (
                                                <div key={idx} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    padding: '1rem',
                                                    background: 'rgba(0,0,0,0.02)',
                                                    borderRadius: '12px',
                                                    marginBottom: '8px',
                                                    alignItems: 'center'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{
                                                            width: '36px', height: '36px',
                                                            borderRadius: '10px',
                                                            background: total === selectedWeek.max ? 'rgba(251, 146, 60, 0.2)' : 'rgba(0,0,0,0.05)',
                                                            color: total === selectedWeek.max ? '#f97316' : 'var(--text-primary)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontWeight: 800, fontSize: '0.9rem'
                                                        }}>
                                                            {dayName.substring(0, 1)}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600 }}>{dayName}</div>
                                                            {total === selectedWeek.max && (
                                                                <div style={{ fontSize: '0.7rem', color: '#fb923c', fontWeight: 700, textTransform: 'uppercase' }}>Pico de Venta</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: total === selectedWeek.max ? '#fb923c' : 'inherit' }}>
                                                            {currencySymbol}{total.toFixed(2)}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                            Bs {(total * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }
        </div >
    );
}
