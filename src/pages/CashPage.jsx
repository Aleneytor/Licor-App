import React, { useMemo, useState, useEffect } from 'react';
import ErrorBoundary from '../components/ErrorBoundary'; // Import ErrorBoundary
import { useOrder } from '../context/OrderContext';
import { useProduct } from '../context/ProductContext';
import { useNotification } from '../context/NotificationContext';
import {
    DollarSign, CheckCircle, Clock, Receipt, TrendingUp, Calendar, Download,
    CreditCard, Smartphone, Banknote, AlertTriangle, Package, Activity, AlertCircle, ShoppingBag, ChevronDown, ChevronUp, User, Maximize2, X, ChevronLeft, ChevronRight, Share2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './CashPage.css'; // Premium Styles

export function CashPageContent() {
    const orderContext = useOrder();
    const productContext = useProduct();
    const notificationContext = useNotification();

    // Defensive Context Access
    const pendingOrders = orderContext?.pendingOrders || [];
    const { getPrice, exchangeRates, currentRate, inventory, beerTypes, subtypes, getUnitsPerEmission, currencySymbol, getCostPrice, getInventoryAssetValue } = productContext || {};
    const { showNotification } = notificationContext || { showNotification: () => { } };

    const [showDailyDetailModal, setShowDailyDetailModal] = useState(false);
    const [dailyDetailDate, setDailyDetailDate] = useState(new Date());
    const [showReportModal, setShowReportModal] = useState(false);
    const [showProfitModal, setShowProfitModal] = useState(false);
    const [showWeeklyModal, setShowWeeklyModal] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);

    // Initial Data Check
    if (!orderContext || !productContext) {
        return <div className="p-8 text-center text-gray-500">Cargando datos del sistema...</div>;
    }

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (showReportModal || showWeeklyModal || showDailyDetailModal || showProfitModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showReportModal, showWeeklyModal, showDailyDetailModal, showProfitModal]);

    // Helper to calculate total for an order
    const getOrderTotal = (items) => {
        if (!Array.isArray(items)) return 0;
        return items.reduce((acc, item) => {
            if (!item) return acc;
            const p = item.price || (getPrice ? getPrice(item.beerType || item.name, item.emission, item.subtype, 'local') : 0);
            return acc + (p * (item.quantity || 1));
        }, 0);
    };

    const displayPayment = (method) => {
        if (!method || method === 'Cash') return 'Efectivo';
        if (typeof method === 'string' && method.startsWith('Pre-Pagado - ')) {
            return method.replace('Pre-Pagado - ', '');
        }
        return String(method); // Safe cast
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

        if (Array.isArray(pendingOrders)) {
            pendingOrders.forEach(order => {
                if (!order) return;
                if (order.status === 'OPEN') {
                    openCount++;
                } else if (order.status === 'PAID') {
                    // ... (Safe logic continues below) -> Assuming inner loop is same until next modify
                    const closedDate = new Date(order.closedAt || order.createdAt);
                    closedDate.setHours(0, 0, 0, 0);

                    const isToday = closedDate.getTime() === today.getTime();
                    const isRecent = closedDate.getTime() >= (today.getTime() - 60 * 24 * 60 * 60 * 1000);

                    if (isRecent) {
                        const total = (order.totalAmountUsd !== undefined && order.totalAmountUsd !== null)
                            ? Number(order.totalAmountUsd)
                            : getOrderTotal(order.items);

                        sales.push({ ...order, total });

                        if (isToday) {
                            totalSales += total;
                            closedCount++;

                            let method = order.paymentMethod || 'Efectivo';

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

                        // Product Stats
                        (order.items || []).forEach(item => {
                            if (!item) return;
                            const name = item.beerType || item.name || 'Desconocido';
                            const emission = item.emission || 'Unidad';
                            const subtype = item.subtype || 'Botella';

                            const unitsPerPack = getUnitsPerEmission ? (getUnitsPerEmission(emission, subtype) || 1) : 1;
                            const totalUnits = (item.quantity || 1) * unitsPerPack;

                            // Include subtype in rank key to distinguish Tercio
                            const rankKey = subtype !== 'Botella' ? `${name} (${subtype})` : name;
                            if (!productCounts[rankKey]) productCounts[rankKey] = 0;
                            productCounts[rankKey] += totalUnits;
                        });
                    }
                }
            });
        }

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
                const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
                const currentDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

                const getWeekData = (offset) => {
                    const targetMonday = new Date();
                    const targetDayNum = targetMonday.getDay() || 7;
                    targetMonday.setDate(targetMonday.getDate() - (targetDayNum - 1) - (offset * 7));
                    targetMonday.setHours(0, 0, 0, 0);

                    const weekTotalData = Array(7).fill(0);
                    const mondayTime = targetMonday.getTime();
                    const sundayTime = mondayTime + (7 * 24 * 60 * 60 * 1000);

                    (pendingOrders || []).forEach(o => {
                        if (o?.status === 'PAID') {
                            const d = new Date(o.closedAt || o.createdAt);
                            const t = d.getTime();
                            if (t >= mondayTime && t < sundayTime) {
                                const dIdx = d.getDay();
                                const cIdx = dIdx === 0 ? 6 : dIdx - 1;
                                const val = (o.totalAmountUsd !== undefined && o.totalAmountUsd !== null)
                                    ? Number(o.totalAmountUsd)
                                    : getOrderTotal(o.items || []);
                                if (weekTotalData[cIdx] !== undefined) {
                                    weekTotalData[cIdx] += val;
                                }
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
                };

                const currentWeek = getWeekData(0);

                return {
                    data: currentWeek.data,
                    total: currentWeek.total,
                    labels: days,
                    maxVal: currentWeek.max || 1,
                    currentDayIndex,
                    getWeekData,
                    historicalWeeks: (() => {
                        // Calculate last 4 weeks totals
                        const weeks = {}; // key: timestamp

                        (pendingOrders || []).forEach(o => {
                            if (o?.status === 'PAID') {
                                const d = new Date(o.closedAt || o.createdAt);
                                const day = d.getDay() || 7;
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

        const rate = currentRate || 0;

        const summaryData = todaysSales.map(sale => {
            // 1. Detailed Consumption Logic
            const consumptionMap = {};

            sale.items.forEach(item => {
                const name = item.beerType || item.name;
                const emission = item.emission || 'Unidad';
                const subtype = item.subtype || 'Botella';
                const qty = item.quantity || 1;

                // Aggregate Consumption - Include Subtype info (Tercio/Lata)
                const detailKey = subtype !== 'Botella' ? `${name} [${subtype}] - ${emission}` : `${name} - ${emission}`;
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
        const rate = currentRate || 0;
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
            `*Total Bs:* ${(sale.total * rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
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

    const rate = currentRate || 0;
    const totalSalesBs = todayStats.totalSales * rate;

    // --- REUSABLE CHART COMPONENT ---
    const WeeklyChart = ({ onClick }) => {
        const compactLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        const nonZeroValues = weeklyStats.data.filter(v => v > 0);
        const effectiveMax = nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 1;

        return (
            <div
                className="dashboard-card weekly-chart-card"
                style={{ height: '100%', cursor: 'pointer' }}
                onClick={onClick}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F97316', boxShadow: '0 0 8px rgba(249, 115, 22, 0.6)' }} />
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Desempeño Semanal</h3>
                    </div>
                    <Calendar size={16} className="text-secondary" />
                </div>

                <div className="chart-container">
                    {weeklyStats.data.map((val, idx) => {
                        const height = (val / effectiveMax) * 100; // % height
                        const isActive = idx === weeklyStats.currentDayIndex;
                        return (
                            <div key={idx} className="chart-bar-wrapper">
                                <div
                                    className={`chart-bar ${isActive ? 'bar-active' : ''}`}
                                    style={{
                                        height: `${Math.max(height, 6)}%`,
                                        opacity: (val === 0 && !isActive) ? 0.3 : 1,
                                        animation: isActive ? 'pulse-orange 2s infinite' : 'none'
                                    }}
                                    data-value={`${currencySymbol}${val.toFixed(0)}`}
                                />
                                <span className="bar-label" style={{
                                    fontWeight: isActive ? '800' : '600',
                                    color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    marginTop: '4px'
                                }}>
                                    {compactLabels[idx]}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    };

    // --- DAILY DETAIL LOGIC ---
    const getSalesForDate = (date) => {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        return (pendingOrders || []).filter(o => {
            if (o?.status !== 'PAID') return false;
            const d = new Date(o.closedAt || o.createdAt);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === targetDate.getTime();
        });
    };

    const dailyHourlyStats = useMemo(() => {
        const sales = getSalesForDate(dailyDetailDate);
        const hourlyData = Array(24).fill(0);
        const productCounts = {};
        let totalSales = 0;

        sales.forEach(sale => {
            // Hourly Distribution
            const date = new Date(sale.closedAt || sale.createdAt);
            const hour = date.getHours();

            const total = (sale.totalAmountUsd !== undefined && sale.totalAmountUsd !== null)
                ? Number(sale.totalAmountUsd)
                : getOrderTotal(sale.items);

            hourlyData[hour] = (hourlyData[hour] || 0) + total;
            totalSales += total;

            // Product Breakdown
            (sale.items || []).forEach(item => {
                if (!item) return; // Skip null items
                const name = item.beerType || item.name || 'Desconocido';
                const emission = item.emission || 'Unidad';
                const subtype = item.subtype || 'Botella';

                const unitsPerPack = getUnitsPerEmission ? (getUnitsPerEmission(emission, subtype) || 1) : 1;
                const totalUnits = (item.quantity || 1) * unitsPerPack;

                if (!productCounts[name]) productCounts[name] = 0;
                productCounts[name] += totalUnits;
            });
        });

        // Top Products for the day
        const sortedProducts = Object.entries(productCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const peakHourVal = Math.max(...hourlyData, 0);
        const peakHour = peakHourVal > 0 ? hourlyData.indexOf(peakHourVal) : -1;

        // Calculate low hour (excluding zeros if possible, or just lowest non-zero)
        // If all zeros, -1. If some sales, find lowest non-zero.
        const activeHours = hourlyData.map((val, idx) => ({ val, idx })).filter(h => h.val > 0);
        activeHours.sort((a, b) => a.val - b.val);
        const lowHour = activeHours.length > 0 ? activeHours[0].idx : -1;

        return {
            hourlyData,
            totalSales,
            topProducts: sortedProducts,
            peakHour,
            lowHour,
            salesCount: sales.length,
            maxHourVal: Math.max(...hourlyData, 1)
        };
    }, [dailyDetailDate, pendingOrders, getPrice, getUnitsPerEmission]);

    const navigateDate = (direction) => {
        const newDate = new Date(dailyDetailDate);
        newDate.setDate(dailyDetailDate.getDate() + direction);
        setDailyDetailDate(newDate);
    };

    const isToday = (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    // --- DAILY CHART COMPONENT (Refined) ---
    const HourlyChart = () => {
        const { hourlyData, maxHourVal, peakHour } = dailyHourlyStats;

        // Key hours to always show as labels
        const anchorHours = [0, 6, 12, 18];

        return (
            <div className="daily-hourly-chart-container" style={{ width: '100%', marginTop: '1rem' }}>
                {/* Bars Container - Shared baseline */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    height: '140px',
                    padding: '0 4px',
                    borderBottom: '1px solid rgba(128, 128, 128, 0.2)' // The "invisible" baseline
                }}>
                    {hourlyData.map((val, hour) => {
                        const h = (val / (maxHourVal || 1)) * 100;
                        const isPeak = hour === peakHour && val > 0;
                        const hasSales = val > 0;
                        const isRelevant = hasSales || anchorHours.includes(hour);

                        // If not relevant and no sales, we make it very thin
                        const barWidth = isRelevant ? '4%' : '2%';
                        const opacity = hasSales ? 1 : 0.3;

                        return (
                            <div key={hour} style={{
                                height: '100%',
                                width: barWidth,
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                position: 'relative'
                            }}>
                                <div
                                    style={{
                                        width: hasSales ? '80%' : '40%',
                                        height: `${Math.max(h, 4)}%`,
                                        background: isPeak ? '#fb923c' : 'rgba(128, 128, 128, 0.4)',
                                        borderRadius: '4px 4px 0 0',
                                        opacity: opacity,
                                        transition: 'all 0.3s ease',
                                        boxShadow: isPeak ? '0 0 12px rgba(251, 146, 60, 0.4)' : 'none',
                                    }}
                                    title={`${hour}:00 - $${val.toFixed(2)}`}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Labels Container - Below the line */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px 0' }}>
                    {hourlyData.map((_, hour) => {
                        const isAnchor = anchorHours.includes(hour);
                        const isPeak = hour === peakHour && dailyHourlyStats.totalSales > 0;
                        const showLabel = isAnchor || isPeak;

                        if (!showLabel) return <div key={hour} style={{ flex: 1 }} />;

                        let labelText = '';
                        if (hour === 0) labelText = '12AM';
                        else if (hour === 12) labelText = '12PM';
                        else if (hour === peakHour) labelText = `${hour}h`;
                        else labelText = `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'PM' : 'AM'}`;

                        return (
                            <div key={hour} style={{
                                flex: 1,
                                textAlign: 'center',
                                fontSize: '0.62rem',
                                fontWeight: isPeak ? '800' : '600',
                                color: isPeak ? '#fb923c' : 'rgba(128, 128, 128, 0.8)'
                            }}>
                                {labelText}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // --- PROFIT ANALYTICS (NEW) ---
    const profitStats = useMemo(() => {
        // 1. Inventory Asset Value
        const inventoryValue = getInventoryAssetValue ? getInventoryAssetValue() : 0;

        // 2. Weekly Profit (Revenue - COGS)
        const currentWeekMilis = weeklyStats.data.reduce((a, b) => a + b, 0); // Gross Revenue

        let weekCOGS = 0;
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        pendingOrders.forEach(o => {
            if (o.status === 'PAID') {
                const d = new Date(o.closedAt || o.createdAt);
                if (d >= monday) {
                    // It's in this week
                    (o.items || []).forEach(item => {
                        const name = item.beerType || item.name;
                        const emission = item.emission || 'Unidad';
                        const subtype = item.subtype || 'Botella';
                        const qty = item.quantity || 1;

                        const cost = getCostPrice(name, emission, subtype);
                        weekCOGS += (cost * qty);
                    });
                }
            }
        });

        const weekNet = currentWeekMilis - weekCOGS;
        const weekMargin = currentWeekMilis > 0 ? ((weekNet / currentWeekMilis) * 100) : 0;

        return {
            inventoryValue,
            weekRevenue: currentWeekMilis,
            weekCOGS,
            weekNet,
            weekMargin
        };
    }, [pendingOrders, weeklyStats, getCostPrice, getInventoryAssetValue]);


    return (
        <div className="page-container">
            {/* DAILY DETAIL MODAL */}
            {showDailyDetailModal && (
                <div className="report-modal-overlay" onClick={() => setShowDailyDetailModal(false)}>
                    <div className="report-modal-content weekly-modal-content" onClick={e => e.stopPropagation()}>

                        {/* Header with Navigation (Weekly Style) */}
                        <div className="report-modal-header weekly-modal-header">
                            <div className="weekly-header-top">
                                <h2 className="weekly-title">
                                    Reporte Diario
                                </h2>
                                <button className="close-btn" onClick={() => setShowDailyDetailModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="weekly-nav-section">
                                <button
                                    className="nav-btn"
                                    onClick={() => navigateDate(-1)}
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <p className="weekly-range" style={{ textTransform: 'capitalize' }}>
                                    {dailyDetailDate.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                                <button
                                    className="nav-btn"
                                    onClick={() => navigateDate(1)}
                                    disabled={isToday(dailyDetailDate)}
                                    style={{ opacity: isToday(dailyDetailDate) ? 0.3 : 1 }}
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="report-modal-body custom-scrollbar">
                            {/* Hero Cards (Weekly Style) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                {/* Total Sales Card */}
                                <div className="dashboard-card" style={{ background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)', color: 'white', border: 'none', padding: '1rem' }}>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Ventas Totales</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                                        {currencySymbol}{(dailyHourlyStats?.totalSales || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 600 }}>
                                        {dailyHourlyStats.salesCount} Tickets
                                    </div>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '2px' }}>
                                        {isToday(dailyDetailDate) ? 'Cierre en Curso' : 'Día Cerrado'}
                                    </div>
                                </div>

                                {/* Peak Hour Card */}
                                <div className="dashboard-card" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(128, 128, 128, 0.1)', padding: '1rem' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Hora Pico</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ADE80' }}>
                                        {dailyHourlyStats.peakHour >= 0 ? `${dailyHourlyStats.peakHour}:00` : '--'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#4ADE80', fontWeight: 600, opacity: 0.9 }}>
                                        Mayor Flujo
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        Hora Baja: {dailyHourlyStats.lowHour >= 0 ? `${dailyHourlyStats.lowHour}:00` : '--'}
                                    </div>
                                </div>
                            </div>

                            {/* Hourly Chart */}
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Desempeño por Hora</h3>
                            <div className="chart-wrapper-box" style={{ marginBottom: '2.5rem', background: 'transparent', padding: 0, boxShadow: 'none' }}>
                                <HourlyChart />
                            </div>

                            {/* Top Products (Styled like Weekly Breakdown) */}
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Productos Top</h3>
                            <div className="products-section">
                                {dailyHourlyStats.topProducts.length === 0 ? (
                                    <div className="empty-state" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No hay actividad registrada.</div>
                                ) : (
                                    dailyHourlyStats.topProducts.map((p, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            padding: '1rem',
                                            background: 'rgba(128, 128, 128, 0.05)',
                                            borderRadius: '12px',
                                            marginBottom: '8px',
                                            alignItems: 'center'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{
                                                    width: '32px', height: '32px',
                                                    borderRadius: '8px',
                                                    background: i === 0 ? 'rgba(251, 146, 60, 0.2)' : 'rgba(128, 128, 128, 0.1)',
                                                    color: i === 0 ? '#f97316' : 'var(--text-secondary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 800, fontSize: '0.9rem'
                                                }}>
                                                    {i + 1}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
                                                    {i === 0 && (
                                                        <div style={{ fontSize: '0.65rem', color: '#fb923c', fontWeight: 700, textTransform: 'uppercase' }}>Más Vendido</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: i === 0 ? '#fb923c' : 'inherit' }}>
                                                    {p.count}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                    Unidades
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW PROFIT REPORT MODAL */}
            {showProfitModal && (
                <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
                    <div className="report-modal-content weekly-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="report-modal-header weekly-modal-header">
                            <div className="weekly-header-top">
                                <h2 className="weekly-title">
                                    Ganancias Netas
                                </h2>
                                <button className="close-btn" onClick={() => setShowProfitModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Semana Actual
                            </div>
                        </div>

                        <div className="report-modal-body custom-scrollbar">
                            {/* Profit Hero */}
                            <div className="dashboard-card" style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white', border: 'none', padding: '1.5rem', marginBottom: '1.5rem'
                            }}>
                                <div style={{ fontSize: '0.85rem', opacity: 0.95, fontWeight: 500 }}>Balance Neto (Semanal)</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0' }}>
                                    {currencySymbol}{profitStats.weekNet.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', opacity: 0.9 }}>
                                    <span>Margen: {profitStats.weekMargin.toFixed(1)}%</span>
                                    <span>•</span>
                                    <span>Bs {(profitStats.weekNet * (exchangeRates.bcv || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {/* Two Col Breakdown */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                {/* Gross Income */}
                                <div className="dashboard-card" style={{ background: 'rgba(128, 128, 128, 0.05)', border: '1px solid rgba(128, 128, 128, 0.1)', padding: '1rem' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ingreso Bruto</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '4px' }}>
                                        {currencySymbol}{profitStats.weekRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', opacity: 0.7 }}>
                                        Total Facturado
                                    </div>
                                </div>
                                {/* COGS */}
                                <div className="dashboard-card" style={{ background: 'rgba(128, 128, 128, 0.05)', border: '1px solid rgba(128, 128, 128, 0.1)', padding: '1rem' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Costo Productos</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                                        -{currencySymbol}{profitStats.weekCOGS.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', opacity: 0.7 }}>
                                        Inversión Vendida
                                    </div>
                                </div>
                            </div>

                            {/* Inventory Asset */}
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Capital en Bodega</h3>
                            <div className="dashboard-card" style={{
                                background: 'rgba(37, 99, 235, 0.08)',
                                border: '1px solid rgba(37, 99, 235, 0.2)',
                                padding: '1.25rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>Valor del Inventario</div>
                                    <div style={{ fontSize: '0.7rem', color: '#2563eb', opacity: 0.8 }}>Costo total de stock actual</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb' }}>
                                        {currencySymbol}{(profitStats?.inventoryValue || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(251, 146, 60, 0.1)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                <AlertTriangle size={16} style={{ display: 'inline', marginBottom: '-3px', marginRight: '5px', color: '#f97316' }} />
                                Para ver datos precisos, asegúrate de configurar los <strong>Precios de Costo</strong> en el Inventario.
                            </div>

                        </div>
                    </div>
                </div>
            )}


            <div className="dashboard-main-container">
                <div className="hero-container">
                    <div
                        className="dashboard-card card-hero"
                        onClick={() => setShowDailyDetailModal(true)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="label">Ventas de Hoy</div>
                        <div className="value">
                            {currencySymbol}{(todayStats?.totalSales || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="sub-value">
                            Bs {(totalSalesBs || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 600 }}>
                            <Activity size={18} />
                            <span>Resumen Diario</span>
                            <TrendingUp size={16} />
                        </div>
                    </div>
                </div>

                <div className="chart-container-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* NEW PROFIT CARD */}
                    <div
                        className="dashboard-card"
                        onClick={() => setShowProfitModal(true)}
                        style={{
                            cursor: 'pointer',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            minHeight: '120px',
                            padding: '1.5rem'
                        }}
                    >
                        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#059669', marginBottom: '0.5rem' }}>Ganancia Neta</div>

                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#10b981', marginBottom: '0.5rem', letterSpacing: '-1px' }}>
                            {currencySymbol}{(profitStats?.weekNet || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </div>

                        <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            width: 'fit-content',
                            color: '#059669',
                            fontWeight: 600,
                            marginBottom: '1rem'
                        }}>
                            Bs {((profitStats?.weekNet || 0) * rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>

                        <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={18} color="#10b981" />
                            <span>Margen Semanal: {(profitStats?.weekMargin || 0).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <div className="table-section-wrapper">
                    <div className="table-container-dark">
                        <div className="table-title-bar">
                            <h3 className="table-title" style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>Tabla de Ventas</h3>
                            <span style={{ fontSize: '0.8rem', opacity: 0.9, fontWeight: 600 }}>Últimos 60 Días</span>
                        </div>

                        <div className="table-header-row">
                            <div className="th-cell">Cliente</div>
                            <div className="th-cell">Fecha</div>
                            <div className="th-cell">Pago</div>
                            <div className="th-cell consumption-cell">Consumo</div>
                            <div className="th-cell user-header">Usuario</div>
                        </div>

                        <div className="table-body-scroll">
                            {todaysSales.length > 0 ? (
                                todaysSales.map((sale) => (
                                    <div key={sale.id} className="table-row">
                                        <div className="td-cell">
                                            <div className="customer-name" style={{ fontWeight: 600 }}>{sale.customerName}</div>
                                            <div className="ticket-number">#{sale.ticketNumber}</div>
                                        </div>
                                        <div className="td-cell date-cell">
                                            <div className="date-text">{new Date(sale.closedAt).toLocaleDateString()}</div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{new Date(sale.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                        <div className="td-cell">
                                            <span className="badge-payment">
                                                <span className="long-method">{displayPayment(sale.paymentMethod)}</span>
                                                <span className="short-method">{getShortPayment(sale.paymentMethod)}</span>
                                            </span>
                                        </div>
                                        <div className="td-cell consumption-cell">
                                            {sale.items.map(item => {
                                                const qty = item.quantity || 1;
                                                const name = item.beerType || item.name;
                                                const emission = item.emission || 'Unidad';
                                                const subtype = item.subtype || 'Botella';
                                                const formatStr = subtype !== 'Botella' ? `[${subtype}] ` : '';
                                                return `${qty} ${name} ${formatStr}(${emission})`;
                                            }).join(', ')}
                                        </div>
                                        <div className="td-cell user-cell">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <User size={14} className="text-secondary" />
                                                <span className="user-name">{sale.createdBy || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    No hay ventas registradas hoy.
                                </div>
                            )}
                        </div>

                        <div className="table-footer">
                            <div className="footer-info">
                                <AlertCircle size={16} style={{ color: '#fb923c' }} />
                                <span>Descarga el Excel para ver un reporte completo</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={handleExport}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.6rem',
                                        fontSize: '0.9rem',
                                        background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Download size={18} />
                                    <span>Excel</span>
                                </button>
                                <button
                                    className="action-btn"
                                    style={{
                                        padding: '0.6rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'white',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        borderRadius: '12px',
                                        cursor: 'pointer'
                                    }}
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
                        {/* Weekly Chart moved here */}
                        <div className="col-span-12" style={{ marginBottom: '1.5rem' }}>
                            <WeeklyChart onClick={() => setShowWeeklyModal(true)} />
                        </div>

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


                    </div>
                </div>


                {/* Full Report Modal */}
                {
                    showReportModal && (
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

                                                {/* Detailed Consumption Items */}
                                                <div className="report-consumption-box" style={{ padding: '10px 0' }}>
                                                    {(sale.items || []).map((item, idx) => {
                                                        const name = item.beerType || item.name;
                                                        const emission = item.emission || 'Unidad';
                                                        const subtype = item.subtype || 'Botella';
                                                        const qty = item.quantity || 1;
                                                        return (
                                                            <div key={idx} className="consumption-item">
                                                                <div className="consumption-dot" style={{ background: methodColor }} />
                                                                <span>
                                                                    {qty} {name} {subtype !== 'Botella' && <span style={{ color: '#f97316', fontWeight: 600 }}>[{subtype}]</span>} <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>({emission})</span>
                                                                </span>
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
                    )
                }

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

                                        {/* 7-Day Chart (Refined Style) */}
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Desempeño Diario</h3>
                                        <div className="weekly-chart-distribution" style={{ width: '100%', marginBottom: '2.5rem' }}>
                                            {/* Bars Container */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'flex-end',
                                                justifyContent: 'space-between',
                                                height: '120px',
                                                padding: '0 10px',
                                                borderBottom: '1px solid rgba(128, 128, 128, 0.2)'
                                            }}>
                                                {selectedWeek.data.map((val, idx) => {
                                                    const h = (val / (selectedWeek.max || 1)) * 100;
                                                    const isPeak = val === selectedWeek.max && val > 0;
                                                    return (
                                                        <div key={idx} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '100%' }}>
                                                            <div
                                                                style={{
                                                                    width: '24px',
                                                                    height: `${Math.max(h, 5)}%`,
                                                                    background: isPeak ? '#fb923c' : 'rgba(128, 128, 128, 0.4)',
                                                                    borderRadius: '4px 4px 0 0',
                                                                    transition: 'all 0.3s ease',
                                                                    boxShadow: isPeak ? '0 0 15px rgba(251, 146, 60, 0.4)' : 'none',
                                                                    position: 'relative'
                                                                }}
                                                            >
                                                                {val > 0 && (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: '-25px',
                                                                        width: '100%',
                                                                        textAlign: 'center',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 700,
                                                                        color: isPeak ? '#fb923c' : 'var(--text-secondary)',
                                                                        whiteSpace: 'nowrap'
                                                                    }}>
                                                                        {val > 999 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Labels Container */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px 0' }}>
                                                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, idx) => {
                                                    const isPeak = selectedWeek.data[idx] === selectedWeek.max && selectedWeek.max > 0;
                                                    return (
                                                        <div key={idx} style={{
                                                            flex: 1,
                                                            textAlign: 'center',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 800,
                                                            color: isPeak ? '#f97316' : 'var(--text-secondary)'
                                                        }}>
                                                            {label}
                                                        </div>
                                                    );
                                                })}
                                            </div>
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
            </div>
        </div>
    );
}

// Wrapper with Error Boundary
export default function CashPage() {
    return (
        <ErrorBoundary>
            <CashPageContent />
        </ErrorBoundary>
    );
}
