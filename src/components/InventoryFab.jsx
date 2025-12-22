import React, { useState } from 'react';
import { useProduct } from '../context/ProductContext';
import { Package, CheckCircle, Trash2 } from 'lucide-react';

export default function InventoryFab() {
    const {
        pendingInventory, commitInventory, clearPendingInventory, getUnitsPerEmission,
        pendingWaste = {}, commitWaste = async () => ({}), clearPendingWaste = () => { }
    } = useProduct();

    const [showSummary, setShowSummary] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [lastReport, setLastReport] = useState(null);

    // Calculate Total Units (Weighted)
    const totalInventoryItems = Object.entries(pendingInventory || {}).reduce((sum, [key, count]) => {
        const parts = key.split('_');
        const emission = parts.pop();
        const subtype = parts.pop();
        const units = getUnitsPerEmission(emission, subtype);
        return sum + (count * units);
    }, 0);

    const totalWasteItems = Object.entries(pendingWaste || {}).reduce((sum, [key, count]) => {
        const parts = key.split('_');
        const emission = parts.pop();
        const subtype = parts.pop();
        const units = getUnitsPerEmission(emission, subtype);
        return sum + (count * units);
    }, 0);

    // Determine active mode based on what has pending items
    // Priority: Waste takes precedence if both exist (or logic to handle both? For now let's handle one at a time visually)
    const isWasteAction = totalWasteItems > 0;
    const activeTotal = isWasteAction ? totalWasteItems : totalInventoryItems;

    if (activeTotal === 0 && !showSummary && !showConfirm) return null;

    const handleClick = () => {
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        let report;
        if (isWasteAction) {
            report = await commitWaste();
        } else {
            report = await commitInventory();
        }
        setLastReport(report);
        setShowConfirm(false);
        setShowSummary(true);
    };

    const handleCancel = () => {
        setShowConfirm(false);
    };

    const handleDiscard = () => {
        if (isWasteAction) clearPendingWaste();
        else clearPendingInventory();
        setShowConfirm(false);
    }

    const handleClose = () => {
        setShowSummary(false);
        setLastReport(null);
    };

    return (
        <>
            {/* Extended FAB with Text when items actice */}
            {activeTotal !== 0 && !showSummary && !showConfirm && (
                <button
                    onClick={handleClick}
                    style={{
                        position: 'fixed',
                        bottom: '120px',
                        right: '1rem',
                        background: isWasteAction
                            ? 'linear-gradient(180deg, #F97316 0%, #EA580C 100%)'
                            : 'linear-gradient(180deg, #FF9C57 0%, #E65900 100%)',
                        color: 'white',
                        padding: '12px 20px',
                        borderRadius: '50px',
                        border: 'none',
                        boxShadow: isWasteAction ? '0 8px 20px rgba(234, 88, 12, 0.4)' : '0 8px 20px rgba(255, 156, 87, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        zIndex: 1000,
                        cursor: 'pointer',
                        fontWeight: 600,
                        animation: 'fadeIn 0.3s ease-out'
                    }}
                >
                    <div style={{ position: 'relative' }}>
                        {isWasteAction ? <Trash2 size={24} /> : <Package size={24} />}
                        <span style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            background: '#fff',
                            color: isWasteAction ? '#EA580C' : '#E65900',
                            fontWeight: 'bold',
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            {activeTotal}
                        </span>
                    </div>
                    <span>{isWasteAction ? 'Confirmar Merma' : 'Guardar Inventario'}</span>
                </button>
            )}

            {/* Confirmation Modal */}
            {showConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(3px)',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '24px',
                        padding: '1.5rem',
                        width: '100%',
                        maxWidth: '320px',
                        textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        color: 'var(--text-primary)'
                    }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                            {isWasteAction ? '¿Reportar Merma?' : '¿Guardar Inventario?'}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            {isWasteAction
                                ? `Estás reportando ${activeTotal} unidades dañadas/rotas. Se descontarán del inventario.`
                                : `Estás a punto de actualizar el stock con ${activeTotal} unidades.`
                            }
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            <button
                                onClick={handleCancel}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-input)',
                                    color: 'var(--text-secondary)',
                                    border: 'none',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleConfirm}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: isWasteAction ? 'linear-gradient(180deg, #F97316 0%, #EA580C 100%)' : 'linear-gradient(180deg, #FF9C57 0%, #E65900 100%)',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(255, 156, 87, 0.2)'
                                }}
                            >
                                Confirmar
                            </button>
                        </div>
                        <button
                            onClick={handleDiscard}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#EF4444',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                padding: '8px'
                            }}
                        >
                            Descartar Cambios
                        </button>
                    </div>
                </div>
            )}

            {/* Session Report Modal */}
            {showSummary && lastReport && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(4px)',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '24px',
                        padding: '1.5rem',
                        width: '100%',
                        maxWidth: '360px',
                        textAlign: 'center',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        color: 'var(--text-primary)'
                    }}>
                        {/* Gradient Definition */}
                        <svg width="0" height="0" style={{ position: 'absolute' }}>
                            <defs>
                                <linearGradient id="inventory-gradient" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="#FF9C57" />
                                    <stop offset="100%" stopColor="#E65900" />
                                </linearGradient>
                            </defs>
                        </svg>

                        <div style={{
                            background: 'rgba(255, 156, 87, 0.15)',
                            width: '64px', height: '64px',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1rem auto',
                            boxShadow: '0 0 0 8px rgba(255, 156, 87, 0.05)'
                        }}>
                            <CheckCircle size={32} style={{ stroke: 'url(#inventory-gradient)' }} />
                        </div>

                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                            {isWasteAction ? '¡Merma Registrada!' : (lastReport.totalUnits < 0 ? '¡Descargo Exitoso!' : '¡Carga Exitosa!')}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            {isWasteAction
                                ? 'Se ha descontado el producto dañado del inventario.'
                                : (lastReport.totalUnits < 0
                                    ? `Has descargado ${Math.abs(lastReport.totalUnits)} unidades del inventario.`
                                    : 'Se ha actualizado el inventario correctamente.')
                            }
                        </p>

                        <div style={{ background: 'var(--bg-input)', borderRadius: '16px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', borderBottom: '1px solid var(--accent-light)', paddingBottom: '0.5rem' }}>
                                REPORTE DE {isWasteAction ? 'MERMA' : 'MOVIMIENTOS'}
                            </div>

                            <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                                {lastReport.movements.map((mov, idx) => {
                                    // FIXED: Display the emission name directly (e.g. "Cajas") instead of trying to calculate fractions
                                    const extraInfo = mov.emission;

                                    return (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{mov.beer} {mov.subtype}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{extraInfo}</span>
                                            </div>
                                            <span style={{ fontWeight: 700, color: (mov.quantity < 0 || isWasteAction) ? '#EF4444' : '#34c759' }}>
                                                {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ borderTop: '1px solid var(--accent-light)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                                <span style={{ color: 'var(--text-primary)' }}>Total Unidades</span>
                                <span style={{ color: (lastReport.totalUnits < 0 || isWasteAction) ? '#EF4444' : 'var(--text-primary)' }}>
                                    {lastReport.totalUnits > 0 ? '+' : ''}{lastReport.totalUnits}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                                {lastReport.timestamp}
                            </div>
                        </div>

                        <button
                            onClick={handleClose}
                            style={{
                                background: isWasteAction ? 'linear-gradient(180deg, #F97316 0%, #EA580C 100%)' : 'linear-gradient(180deg, #FF9C57 0%, #E65900 100%)',
                                color: 'white',
                                width: '100%',
                                padding: '12px',
                                borderRadius: '12px',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '1rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 10px rgba(234, 88, 12, 0.2)'
                            }}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
