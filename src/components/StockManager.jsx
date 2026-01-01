
import React, { useState } from 'react';
import { useProduct } from '../context/ProductContext';
import { useOrder } from '../context/OrderContext';
import { Minus, Plus, Box, Package, ChevronDown, ChevronUp, Layers, Trash2, AlertTriangle, Check } from 'lucide-react';
import ContainerSelector from './ContainerSelector';

// --- REAL TIME STOCK CALCULATION HELPER ---
const getReservedQuantity = (pendingOrders, getUnitsPerEmission, beer, subtype) => {
    if (!pendingOrders) return 0;
    let reserved = 0;
    pendingOrders.forEach(order => {
        if (order.status !== 'OPEN') return;
        order.items.forEach(item => {
            if (item.name === beer && item.subtype === subtype) {
                const emission = item.emission || 'Unidad';
                const units = getUnitsPerEmission(emission, subtype);
                reserved += (item.quantity * units);
            }
        });
    });
    return reserved;
};

// --- STOCK CONTROL ROW COMPONENT ---
const StockRow = ({ beer, subtype, emission, icon: Icon }) => {
    const {
        getInventory,
        getUnitsPerEmission,
        pendingInventory,
        updatePendingInventory,
        getPendingInventory,
        setPendingInventoryValue
    } = useProduct();

    const { pendingOrders } = useOrder();

    const currentStock = getInventory(beer, subtype);
    const reservedStock = getReservedQuantity(pendingOrders, getUnitsPerEmission, beer, subtype);
    const effectiveStock = currentStock - reservedStock;

    // Pending Input
    const pendingCount = getPendingInventory(beer, subtype, emission);
    const isNegative = pendingCount < 0;
    const isPositive = pendingCount > 0;
    const activeColor = isNegative ? '#EF4444' : (isPositive ? '#34c759' : 'var(--text-primary)');

    const relevantPending = pendingInventory || {};
    const allPendingForSubtype = Object.entries(relevantPending).reduce((sum, [key, qty]) => {
        if (key.startsWith(`${beer}_${subtype}_`)) {
            const parts = key.split('_');
            const em = parts[parts.length - 1];
            return sum + (qty * getUnitsPerEmission(em, subtype));
        }
        return sum;
    }, 0);

    const previewTotal = effectiveStock + allPendingForSubtype;

    return (
        <div className="stock-row" style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '1rem',
            borderBottom: '1px solid #f0f0f0',
            gap: '0.75rem',
            background: 'transparent',
            borderRadius: '12px'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Icon size={20} className="text-gray-500" style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>{emission}</span>
                </div>

                {/* Stock Display */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ color: '#666' }}>Actual: {effectiveStock}</span>
                    {reservedStock > 0 && (
                        <span style={{ fontSize: '0.70rem', color: '#F59E0B', background: '#FFFBEB', padding: '2px 4px', borderRadius: '4px' }}>
                            (Res: {reservedStock})
                        </span>
                    )}

                    {allPendingForSubtype !== 0 && (
                        <>
                            <span style={{ color: '#ccc' }}>&rarr;</span>
                            <span style={{ color: (allPendingForSubtype < 0 ? '#EF4444' : '#34c759'), fontWeight: 700 }}>
                                {previewTotal}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Input Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0.5rem' }}>
                <div className="stock-controls" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'var(--bg-app)', padding: '6px 12px', borderRadius: '16px' }}>
                    <button
                        onClick={() => updatePendingInventory(beer, subtype, emission, -1)}
                        style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--bg-card-hover)', border: '1px solid var(--accent-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Minus size={22} color="var(--text-primary)" />
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 1rem', minWidth: '110px' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>
                            {isNegative ? 'RETIRAR' : 'AGREGAR'}
                        </span>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={pendingCount === 0 ? '' : Math.abs(pendingCount)}
                            onChange={(e) => {
                                const raw = e.target.value;
                                const val = raw === '' ? 0 : parseInt(raw.slice(0, 6), 10);
                                if (isNaN(val)) return;

                                if (val === 0) {
                                    setPendingInventoryValue(beer, subtype, emission, 0);
                                    return;
                                }

                                const sign = pendingCount < 0 ? -1 : 1;
                                setPendingInventoryValue(beer, subtype, emission, val * sign);
                            }}
                            onFocus={(e) => e.target.select()}
                            style={{
                                fontSize: '1.5rem',
                                fontWeight: 800,
                                color: activeColor,
                                textAlign: 'center',
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                padding: '0',
                                WebkitAppearance: 'none',
                                MozAppearance: 'textfield'
                            }}
                            placeholder="0"
                        />
                    </div>

                    <button
                        onClick={() => updatePendingInventory(beer, subtype, emission, 1)}
                        style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--bg-card-hover)', border: '1px solid var(--accent-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Plus size={22} color="var(--text-primary)" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function StockManager() {
    const {
        beerTypes,
        getInventory,
        getUnitsPerEmission,
        pendingInventory,
        updatePendingInventory,
        getPendingInventory,
        setPendingInventoryValue,
        inventoryHistory,
        breakageHistory = [],
    } = useProduct();

    const { pendingOrders } = useOrder();

    const [historyOpen, setHistoryOpen] = useState(false);
    const [wasteSectionOpen, setWasteSectionOpen] = useState(false);
    const [expandedSections, setExpandedSections] = useState({});
    const [beerSubtypes, setBeerSubtypes] = useState({});

    // Summary Items (Only for normal inventory)
    const summaryItems = [];
    if (pendingInventory) {
        Object.entries(pendingInventory).forEach(([key, count]) => {
            if (count === 0) return;
            const parts = key.split('_');
            const emission = parts.pop();
            const subtype = parts.pop();
            const beer = parts.join('_');
            summaryItems.push({ beer, subtype, emission, count });
        });
    }

    const toggleSection = (beer) => {
        setExpandedSections(prev => ({ ...prev, [beer]: !prev[beer] }));
        if (!beerSubtypes[beer]) {
            setBeerSubtypes(prev => ({ ...prev, [beer]: 'Botella' }));
        }
    };

    const handleSubtypeChange = (beer, subtype) => {
        setBeerSubtypes(prev => ({ ...prev, [beer]: subtype }));
    };

    // Merge History for the big modal
    const safeInvHistory = Array.isArray(inventoryHistory) ? inventoryHistory : [];
    const safeBreakHistory = Array.isArray(breakageHistory) ? breakageHistory : [];

    // Combine and sort by date (actual date objects or strings)
    const allHistory = [...safeInvHistory, ...safeBreakHistory].sort((a, b) => {
        const dateA = new Date(a.created_at || a.timestamp);
        const dateB = new Date(b.created_at || b.timestamp);
        return dateB - dateA;
    });

    // Recent Waste for the footer section
    const recentWaste = safeBreakHistory.slice(0, 5);

    return (
        <div className="stock-manager-container" style={{ paddingBottom: '120px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 className="section-title text-lg font-bold" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <Box size={20} />
                        Gestión de Inventario
                    </h3>
                    <button
                        onClick={() => setHistoryOpen(true)}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--bg-card-hover)',
                            border: '1px solid var(--accent-light)',
                            borderRadius: '12px',
                            color: '#475569',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Historial
                    </button>
                </div>
            </div>

            <div className="stock-grid" style={{ display: 'grid', gap: '1rem' }}>
                {Array.isArray(beerTypes) && beerTypes.map(beer => {
                    const isExpanded = expandedSections[beer];
                    const hasPending = pendingInventory && Object.keys(pendingInventory).some(k => k.startsWith(beer + '_'));
                    const activeSubtype = beerSubtypes[beer] || 'Botella';

                    return (
                        <div key={beer} className="beer-stock-card" style={{
                            background: 'var(--bg-card)', borderRadius: '16px',
                            border: '1px solid var(--accent-light)',
                            overflow: 'hidden',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                        }}>
                            <div
                                onClick={() => toggleSection(beer)}
                                style={{
                                    padding: '0.75rem 1rem',
                                    background: 'var(--bg-card-hover)',
                                    borderBottom: isExpanded ? '1px solid var(--accent-light)' : 'none',
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {beer}
                                    {hasPending && !isExpanded && (
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
                                    )}
                                </span>
                                {isExpanded ? <ChevronUp size={20} color="#9ca3af" /> : <ChevronDown size={20} color="#9ca3af" />}
                            </div>

                            {isExpanded && (
                                <div style={{ padding: '1rem ' }}>
                                    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-hover)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--accent-light)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <Check size={18} color={activeSubtype === 'Botella Tercio' ? '#34C759' : 'var(--text-secondary)'} />
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Formato Tercio</div>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Ajuste para cajas de 24</div>
                                                </div>
                                            </div>
                                            <div
                                                onClick={() => handleSubtypeChange(beer, activeSubtype === 'Botella Tercio' ? 'Botella' : 'Botella Tercio')}
                                                style={{ width: '38px', height: '20px', background: activeSubtype === 'Botella Tercio' ? '#34C759' : '#ccc', borderRadius: '15px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}
                                            >
                                                <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: activeSubtype === 'Botella Tercio' ? '20px' : '2px', transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                                            </div>
                                        </div>

                                        {activeSubtype !== 'Botella Tercio' && (
                                            <>
                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Configurar para:</label>
                                                <ContainerSelector
                                                    value={activeSubtype}
                                                    onChange={(val) => handleSubtypeChange(beer, val)}
                                                />
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        {['Caja', 'Unidad'].map(emission => (
                                            <StockRow
                                                key={`${beer}-${emission}-${activeSubtype}`}
                                                beer={beer}
                                                subtype={activeSubtype}
                                                emission={emission}
                                                icon={emission === 'Caja' ? Package : Layers}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* SUMMARY SECTION */}
            {summaryItems.length > 0 && (
                <div className="inventory-summary" style={{
                    marginTop: '2rem',
                    background: 'var(--bg-card-active)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    color: 'var(--text-primary)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    border: '1px solid var(--accent-light)'
                }}>
                    <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--accent-light)', paddingBottom: '0.5rem' }}>
                        Resumen de Movimientos
                    </h4>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {summaryItems.map((item, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', alignItems: 'center', fontSize: '0.9rem' }}>
                                <div style={{ fontWeight: 500 }}>
                                    {item.beer} <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>{item.subtype}</span>
                                </div>
                                <div style={{ textAlign: 'right', fontWeight: 400, color: '#9CA3AF' }}></div>
                                <div style={{ textAlign: 'right', fontWeight: 700, color: item.count < 0 ? '#EF4444' : '#34D399' }}>
                                    {item.count > 0 ? '+' : ''}{item.count} {item.emission}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* DEDICATED WASTE SECTION */}
            <div style={{ marginTop: '2rem', marginBottom: '5rem', border: '1px solid var(--accent-light)', borderRadius: '16px', overflow: 'hidden' }}>
                <div
                    onClick={() => setWasteSectionOpen(!wasteSectionOpen)}
                    style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        padding: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        color: '#EF4444'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Trash2 size={20} />
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Mermas / Daños Recientes</span>
                    </div>
                    {wasteSectionOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                {wasteSectionOpen && (
                    <div style={{ background: 'var(--bg-card)', padding: '1rem' }}>
                        {recentWaste.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem', fontStyle: 'italic' }}>
                                No hay reportes de merma recientes.
                            </p>
                        ) : (
                            recentWaste.map(report => (
                                <div key={report.id} style={{
                                    marginBottom: '0.75rem',
                                    paddingBottom: '0.75rem',
                                    borderBottom: '1px solid var(--accent-light)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {report.timestamp}
                                        </div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {report.movements[0]?.beer} ({report.movements[0]?.subtype})
                                        </div>
                                    </div>
                                    <div style={{
                                        color: '#EF4444',
                                        fontWeight: 700,
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem'
                                    }}>
                                        -{report.totalUnits} Uds
                                    </div>
                                </div>
                            ))
                        )}
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            Reporta mermas desde la pantalla de Ventas &gt; Pendientes.
                        </div>
                    </div>
                )}
            </div>

            {/* UNIFIED HISTORY MODAL */}
            {historyOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2000, backdropFilter: 'blur(2px)', padding: '1rem'
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: '24px',
                        width: '100%', maxWidth: '400px', maxHeight: '80vh',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--accent-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Historial Completo</h3>
                            <button onClick={() => setHistoryOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>&times;</button>
                        </div>
                        <div style={{ padding: '1rem', overflowY: 'auto', background: 'var(--bg-app)' }}>
                            {allHistory.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '2rem' }}>No hay registros recientes.</p>
                            ) : (
                                allHistory.map((report) => {
                                    const isWaste = report.type === 'WASTE';
                                    return (
                                        <div key={report.id} style={{
                                            background: 'var(--bg-card)', borderRadius: '12px', padding: '1rem',
                                            marginBottom: '0.8rem', border: '1px solid var(--accent-light)',
                                            borderLeft: isWaste ? '4px solid #BE123C' : '4px solid var(--accent)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{report.timestamp}</span>
                                                <span style={{
                                                    background: isWaste ? '#FFE4E6' : (report.totalUnits < 0 ? '#FEE2E2' : '#e0f2fe'),
                                                    color: isWaste ? '#BE123C' : (report.totalUnits < 0 ? '#991B1B' : '#0284c7'),
                                                    fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 600
                                                }}>
                                                    {isWaste ? 'MERMA' : (report.totalUnits > 0 ? '+' : '') + report.totalUnits + ' Uds'}
                                                </span>
                                            </div>
                                            <div style={{ borderTop: '1px solid var(--accent-light)', paddingTop: '0.5rem' }}>
                                                {report.movements.map(m => (
                                                    <div key={Math.random()} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                                        <span style={{ color: 'var(--text-primary)' }}>{m.beer} {m.subtype} ({m.emission})</span>
                                                        <span style={{ fontWeight: 600, color: isWaste || m.quantity < 0 ? '#EF4444' : '#34c759' }}>
                                                            {isWaste ? '-' : (m.quantity > 0 ? '+' : '')}{m.quantity}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div style={{ padding: '1rem', borderTop: '1px solid var(--accent-light)', background: 'var(--bg-card)' }}>
                            <button onClick={() => setHistoryOpen(false)} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--accent)', color: 'var(--bg-card)', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
