import React, { useState, useEffect } from 'react';
import { Shield, Zap } from 'lucide-react';

/**
 * LicenseStatusBanner - Banner compacto para mostrar estado de licencia
 * Se muestra en la parte superior de ajustes cuando la licencia está inactiva
 */
export default function LicenseStatusBanner({ onTrialClick }) {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div style={{
            background: 'rgba(250, 133, 43, 0.1)',
            border: '2px solid #FA852B',
            borderRadius: isMobile ? '16px' : '20px',
            padding: isMobile ? '0.75rem' : '1rem 1.25rem',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? '0.75rem' : '1rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(250, 133, 43, 0.15)'
        }}>
            {/* Contenedor superior en móvil: icono + texto */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '0.75rem' : '1rem',
                flex: 1,
                minWidth: 0
            }}>
                {/* Icono */}
                <div style={{
                    width: isMobile ? '40px' : '48px',
                    height: isMobile ? '40px' : '48px',
                    background: '#FA852B',
                    borderRadius: isMobile ? '10px' : '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0
                }}>
                    <Shield size={isMobile ? 20 : 24} />
                </div>

                {/* Contenido */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{
                        color: '#FA852B',
                        fontSize: isMobile ? '0.9rem' : '1rem',
                        fontWeight: 800,
                        margin: '0 0 0.15rem 0'
                    }}>
                        Acceso Restringido
                    </h4>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: isMobile ? '0.75rem' : '0.85rem',
                        margin: 0,
                        lineHeight: 1.3
                    }}>
                        {isMobile ? 'Activa la licencia para usar el menú.' : 'Para usar las funciones del menú activa la licencia.'}
                    </p>
                </div>
            </div>

            {/* Botones */}
            <div className="banner-buttons" style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? '0.5rem' : '0.5rem',
                flexShrink: 0,
                width: isMobile ? '100%' : 'auto'
            }}>
                <button
                    onClick={onTrialClick}
                    style={{
                        background: 'linear-gradient(135deg, #FF8C00 0%, #FF7900 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: isMobile ? '10px' : '12px',
                        padding: isMobile ? '0.6rem 0.75rem' : '0.65rem 1rem',
                        fontSize: isMobile ? '0.8rem' : '0.85rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(255, 140, 0, 0.3)',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        width: isMobile ? '100%' : 'auto'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <Zap size={isMobile ? 14 : 16} fill="white" />
                    Probar 7 Días
                </button>

                <a
                    href="https://wa.me/584220131019?text=Hola,%20quisiera%20activar%20mi%20cuenta%20de%20Kavas%20App."
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        background: '#10B981',
                        color: 'white',
                        border: 'none',
                        borderRadius: isMobile ? '10px' : '12px',
                        padding: isMobile ? '0.6rem 0.75rem' : '0.65rem 1rem',
                        fontSize: isMobile ? '0.8rem' : '0.85rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        transition: 'all 0.2s',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        width: isMobile ? '100%' : 'auto'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <img src="/Whatsapp.svg" alt="WhatsApp" style={{ width: isMobile ? '14px' : '16px', height: isMobile ? '14px' : '16px' }} />
                    Activar Ahora
                </a>
            </div>
        </div>
    );
}
