import React from 'react';
import { Zap, X, CheckCircle2, LayoutDashboard, BarChart3, Package, Users2, BadgeDollarSign, RefreshCw, Star, ArrowRight } from 'lucide-react';

export default function TrialActivationModal({ isOpen, onClose, onConfirm, isActivating }) {
    if (!isOpen) return null;

    const benefits = [
        { icon: LayoutDashboard, title: 'Gestión de ventas y caja', desc: 'Control total de tus transacciones diarias.' },
        { icon: BarChart3, title: 'Reportes en tiempo real', desc: 'Estadísticas precisas de tu rentabilidad.' },
        { icon: Package, title: 'Inventario inteligente', desc: 'Alertas de stock y control de mermas.' },
        { icon: Users2, title: 'Usuarios y permisos', desc: 'Asigna roles a tu equipo de trabajo.' },
        { icon: BadgeDollarSign, title: 'Precios y conversiones', desc: 'Manejo multimoneda automático.' },
        { icon: RefreshCw, title: 'Sincronización total', desc: 'Tus datos seguros en todo momento.' }
    ];

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }} onClick={onClose}>
            <div
                style={{
                    background: 'var(--bg-card)',
                    width: '100%',
                    maxWidth: '850px',
                    borderRadius: '40px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.6)',
                    position: 'relative',
                    animation: 'modalEntrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header Section */}
                <div style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    padding: '2rem 1.5rem',
                    textAlign: 'center',
                    position: 'relative',
                    color: 'white',
                    flexShrink: 0
                }}>
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '120%',
                        height: '100%',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                        pointerEvents: 'none'
                    }} />

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        padding: '4px 12px',
                        borderRadius: '100px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        marginBottom: '0.75rem',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                        <Star size={12} fill="white" /> ACCESO PREMIUM GRATUITO
                    </div>

                    <h2 className="modal-title" style={{
                        margin: 0,
                        fontWeight: 900,
                        letterSpacing: '-1px',
                        lineHeight: 1.1
                    }}>
                        ¡Prueba Gratis por 7 Días!
                    </h2>
                    <p className="modal-subtitle" style={{
                        margin: '8px 0 0 0',
                        opacity: 0.9,
                        fontWeight: 500
                    }}>
                        Desbloquea el potencial máximo de tu negocio hoy mismo.
                    </p>

                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            background: 'rgba(0, 0, 0, 0.15)',
                            border: 'none',
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white',
                            transition: 'all 0.2s',
                            zIndex: 10
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content Section with Scroll */}
                <div style={{
                    padding: '1.5rem',
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    background: 'var(--bg-card)'
                }}>
                    <p style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <div style={{ width: '4px', height: '16px', background: '#10B981', borderRadius: '4px' }} />
                        Beneficios incluidos
                    </p>

                    <div className="benefits-grid" style={{
                        display: 'grid',
                        gap: '10px',
                        marginBottom: '1.5rem'
                    }}>
                        {benefits.map((benefit, i) => (
                            <div key={i} className="benefit-card">
                                <div className="benefit-icon-wrapper">
                                    <benefit.icon size={18} color="#10B981" strokeWidth={2.5} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {benefit.title}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                                        {benefit.desc}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Info & Pulse */}
                    <div style={{
                        background: 'var(--bg-card-hover)',
                        borderRadius: '20px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        border: '1px solid var(--accent-light)'
                    }}>
                        <div className="zap-wrapper" style={{
                            width: '40px',
                            height: '40px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <Zap size={20} color="#10B981" fill="#10B981" className="zap-pulse" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10B981' }}>
                                Sin tarjetas ni compromisos
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                Al terminar, obtén <b>1 mes adicional gratis</b> al contactarnos.
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="modal-actions">
                        <button
                            disabled={isActivating}
                            onClick={onConfirm}
                            className="btn-activate"
                            style={{
                                padding: '16px',
                                borderRadius: '16px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                color: 'white',
                                fontWeight: 800,
                                fontSize: '1rem',
                                cursor: 'pointer',
                                boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                flex: 1.5
                            }}
                        >
                            {isActivating ? (
                                'Configurando...'
                            ) : (
                                <>
                                    Activar Mis 7 Días Gratis
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            className="btn-later"
                            style={{
                                padding: '16px',
                                borderRadius: '16px',
                                border: '1px solid var(--accent-light)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                flex: 1
                            }}
                        >
                            Quizás más tarde
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .modal-title {
                    font-size: 2.2rem;
                }
                .modal-subtitle {
                    font-size: 1.1rem;
                }
                .benefits-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                .modal-actions {
                    display: flex;
                    gap: 12px;
                }
                
                @media (max-width: 640px) {
                    .modal-title {
                        font-size: 1.5rem;
                    }
                    .modal-subtitle {
                        font-size: 0.95rem;
                    }
                    .benefits-grid {
                        grid-template-columns: 1fr;
                    }
                    .modal-actions {
                        flex-direction: column;
                    }
                    .btn-activate {
                        order: 1;
                    }
                    .btn-later {
                        order: 2;
                        padding: 12px !important;
                    }
                }

                .benefit-card {
                    padding: 10px 12px;
                    border-radius: 16px;
                    background: var(--bg-card);
                    border: 1px solid var(--accent-light);
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    transition: all 0.3s ease;
                }

                .benefit-card:hover {
                    transform: translateY(-2px);
                    border-color: #10B981;
                    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.1);
                }

                .benefit-icon-wrapper {
                    width: 36px;
                    height: 36px;
                    background: var(--bg-card-hover);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    border: 1px solid var(--accent-light);
                }

                .zap-pulse {
                    animation: zapPulse 2s infinite;
                }

                @keyframes zapPulse {
                    0% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(16, 185, 129, 0)); }
                    50% { transform: scale(1.1); filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.4)); }
                    100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(16, 185, 129, 0)); }
                }

                @keyframes modalEntrance {
                    from { transform: scale(0.9) translateY(40px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .btn-activate:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 24px rgba(16, 185, 129, 0.3);
                    filter: brightness(1.1);
                }

                .btn-later:hover {
                    background: var(--bg-card-hover);
                    color: var(--text-primary);
                }
            `}</style>
        </div>
    );
}
