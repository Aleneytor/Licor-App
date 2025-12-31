import React from 'react';
import { Zap, X, CheckCircle2, MessageCircle, Clock } from 'lucide-react';

export default function TrialActivationModal({ isOpen, onClose, onConfirm, isActivating }) {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.3s ease'
        }} onClick={onClose}>
            <div
                style={{
                    background: 'var(--bg-card)',
                    width: '100%',
                    maxWidth: '450px',
                    borderRadius: '32px',
                    overflow: 'hidden',
                    border: '1px solid var(--accent-light)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    position: 'relative',
                    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header Decor */}
                <div style={{
                    height: '140px',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                    }}>
                        <Zap size={40} color="white" fill="white" />
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            background: 'rgba(0, 0, 0, 0.2)',
                            border: 'none',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '2rem' }}>
                    <h2 style={{
                        margin: '0 0 0.5rem 0',
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        textAlign: 'center',
                        color: 'var(--text-primary)'
                    }}>
                        Prueba Gratuita de 7 Días
                    </h2>
                    <p style={{
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        fontSize: '0.95rem',
                        lineHeight: 1.5,
                        marginBottom: '2rem'
                    }}>
                        Activa el acceso total ahora mismo y descubre cómo potenciar tu negocio sin límites.
                    </p>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        marginBottom: '2.5rem'
                    }}>
                        {[
                            { icon: Clock, text: '7 días de todas las funciones premium' },
                            { icon: CheckCircle2, text: 'Sincronización en tiempo real' },
                            { icon: MessageCircle, text: 'Al terminar, ¡te regalamos 1 mes más!' }
                        ].map((item, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: 'var(--bg-card-hover)',
                                padding: '12px 16px',
                                borderRadius: '16px',
                                border: '1px solid var(--accent-light)'
                            }}>
                                <item.icon size={20} color="#10B981" />
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.text}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{
                        background: 'rgba(16, 185, 129, 0.05)',
                        border: '1px dashed rgba(16, 185, 129, 0.3)',
                        borderRadius: '16px',
                        padding: '1rem',
                        marginBottom: '2.5rem',
                        textAlign: 'center'
                    }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#10B981', fontWeight: 700 }}>
                            ⚠️ Información Importante
                        </p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            Después de los 7 días, tu acceso será restringido. Solo deberás escribirnos por WhatsApp para recibir el mes adicional gratis.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            disabled={isActivating}
                            onClick={onConfirm}
                            style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: '16px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                color: 'white',
                                fontWeight: 800,
                                fontSize: '1.1rem',
                                cursor: 'pointer',
                                boxShadow: '0 8px 16px rgba(16, 185, 129, 0.3)',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px'
                            }}
                        >
                            {isActivating ? (
                                'Activando...'
                            ) : (
                                <>
                                    <Zap size={20} fill="white" />
                                    Activar Mis 7 Días
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '16px',
                                border: '1px solid var(--accent-light)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Quizás más tarde
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
