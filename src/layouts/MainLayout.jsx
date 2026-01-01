import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Receipt, ClipboardList, Settings, Shield, Zap, LayoutDashboard, BarChart3, Package, Users2, BadgeDollarSign, RefreshCw } from 'lucide-react';
import InventoryFab from '../components/InventoryFab';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import './MainLayout.css';

export default function MainLayout() {
    const { role, isLicenseActive, organizationId, refreshLicense } = useAuth();
    const location = useLocation();
    const isAjustes = location.pathname === '/ajustes';
    const isDeveloper = location.pathname === '/developer';

    const [showTrialModal, setShowTrialModal] = React.useState(false);
    const [isActivating, setIsActivating] = React.useState(false);

    const handleConfirmTrial = async () => {
        if (!organizationId) return;
        setIsActivating(true);
        try {
            const { error } = await supabase
                .from('organizations')
                .update({ trial_started_at: new Date().toISOString() })
                .eq('id', organizationId);

            if (error) throw error;

            await refreshLicense();
            setShowTrialModal(false);
        } catch (err) {
            console.error('Error activating trial:', err);
        } finally {
            setIsActivating(false);
        }
    };

    const getBlockMessage = () => {
        const path = location.pathname;
        if (path.includes('vender')) return 'Para usar las funciones del menú Vender activa la licencia.';
        if (path.includes('caja')) return 'Para usar las funciones del menú Caja activa la licencia.';
        if (path.includes('pendientes')) return 'Para usar las funciones del menú Consumos activa la licencia.';
        return 'Activa Licencias en el menú activación en Ajustes para continuar usando la aplicación.';
    };


    // Base navigation items
    const baseNavItems = [
        { path: '/vender', label: 'Vender', icon: ShoppingBag },
        { path: '/pendientes', label: 'Pendientes', icon: ClipboardList },
        { path: '/caja', label: 'Caja', icon: Receipt, restrictedFor: ['employee'] },
        { path: '/ajustes', label: 'Ajustes', icon: Settings },
    ];

    // Filter based on role
    const navItems = baseNavItems.filter(item => {
        if (item.restrictedFor?.includes(role?.toLowerCase())) {
            return false;
        }
        return true;
    });

    if (role?.toLowerCase() === 'developer') {
        navItems.push({ path: '/developer', label: 'Dev', icon: Shield });
    }

    const [isCompact, setIsCompact] = React.useState(false);
    const lastScrollY = React.useRef(0);

    React.useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Only trigger on mobile/tablet widths if needed, but CSS media queries handle the display.
            // Logic: Scroll DOWN -> Compact (True), Scroll UP -> Expanded (False)
            // Threshold: 50px to avoid jitter at very top

            if (currentScrollY > 50) {
                if (currentScrollY > lastScrollY.current) {
                    // Scrolling DOWN
                    setIsCompact(true);
                } else {
                    // Scrolling UP
                    setIsCompact(false);
                }
            } else {
                // At the top
                setIsCompact(false);
            }

            lastScrollY.current = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Get active index for sliding pill animation - pure CSS approach, no DOM measurements
    const activeIndex = navItems.findIndex(item => location.pathname === item.path);
    const sliderPosition = activeIndex >= 0 ? activeIndex : 0;

    // Swipe navigation for mobile
    const navigate = useNavigate();
    const touchStart = React.useRef({ x: 0, y: 0 });
    const touchEnd = React.useRef({ x: 0, y: 0 });
    const containerRef = React.useRef(null);
    const isTransitioning = React.useRef(false);
    const [swipeDirection, setSwipeDirection] = React.useState(null);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleTouchStart = (e) => {
            if (isTransitioning.current) return;
            touchStart.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            touchEnd.current = { x: 0, y: 0 };
        };

        const handleTouchMove = (e) => {
            if (isTransitioning.current) return;
            touchEnd.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        };

        const handleTouchEnd = () => {
            if (isTransitioning.current || touchEnd.current.x === 0) return;

            const deltaX = touchStart.current.x - touchEnd.current.x;
            const deltaY = Math.abs(touchStart.current.y - touchEnd.current.y);
            const minSwipeDistance = 80;

            if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > deltaY * 1.8) {
                let nextPath = null;
                let outClass = '';
                let inClass = '';

                if (deltaX > 0) {
                    // Swiped LEFT -> Next
                    const nextIndex = activeIndex + 1;
                    if (nextIndex < navItems.length) {
                        nextPath = navItems[nextIndex].path;
                        outClass = 'slide-out-left';
                        inClass = 'slide-in-right';
                    }
                } else {
                    // Swiped RIGHT -> Prev
                    const prevIndex = activeIndex - 1;
                    if (prevIndex >= 0) {
                        nextPath = navItems[prevIndex].path;
                        outClass = 'slide-out-right';
                        inClass = 'slide-in-left';
                    }
                }

                if (nextPath) {
                    isTransitioning.current = true;
                    setSwipeDirection(outClass);

                    // Tiempo sincronizado con el CSS (0.12s)
                    setTimeout(() => {
                        window.scrollTo(0, 0);
                        navigate(nextPath);
                        // Aplicamos la entrada en el mismo ciclo para evitar el "blink"
                        setSwipeDirection(inClass);

                        // Limpiamos después de que la animación de entrada termine (0.2s)
                        setTimeout(() => {
                            setSwipeDirection(null);
                            isTransitioning.current = false;
                        }, 250);
                    }, 120);
                }
            }
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [activeIndex, navItems, navigate]);

    return (
        <div ref={containerRef} className="layout-container">
            <nav className={`main-nav ${isCompact ? 'compact-wrapper' : ''}`}>
                <div className={`nav-pill ${isCompact ? 'compact' : ''}`} style={{ '--nav-items': navItems.length, '--active-index': sliderPosition }}>
                    {/* Sliding background pill - uses CSS calc() for position */}
                    <div className="nav-slider" />
                    {navItems.map((item, index) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? 'active' : ''}`
                            }
                            onClick={(e) => {
                                // If clicking the active tab, dispatch reset event
                                if (window.location.pathname === item.path) {
                                    window.dispatchEvent(new CustomEvent('reset-flow', { detail: item.path }));
                                }
                            }}
                        >
                            <item.icon className="nav-icon" strokeWidth={2} />
                            <span className="nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>

            <main key={location.pathname} className={`main-content ${swipeDirection ? swipeDirection : ''}`}>
                {(!isLicenseActive && !isAjustes && !isDeveloper) ? (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            background: 'rgba(250, 133, 43, 0.1)',
                            border: '1px solid #FA852B',
                            padding: '2.5rem 2rem',
                            borderRadius: '32px',
                            maxWidth: '450px',
                            boxShadow: '0 10px 40px rgba(250, 133, 43, 0.15)'
                        }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: '#FA852B',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                color: 'white'
                            }}>
                                <Shield size={32} />
                            </div>
                            <h2 style={{ color: '#FA852B', marginBottom: '1rem', fontSize: '1.75rem', fontWeight: 800 }}>Acceso Restringido</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6', fontSize: '1rem', fontWeight: 500 }}>
                                {getBlockMessage()}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button
                                    onClick={() => setShowTrialModal(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        padding: '16px 24px',
                                        background: 'linear-gradient(135deg, #FF8C00 0%, #FF7900 100%)',
                                        color: 'white',
                                        borderRadius: '16px',
                                        border: 'none',
                                        fontWeight: 800,
                                        fontSize: '1.1rem',
                                        boxShadow: '0 8px 20px rgba(255, 140, 0, 0.4)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Zap size={20} fill="white" />
                                    Probar 7 Días
                                </button>
                                <a
                                    href={`https://wa.me/584220131019?text=Hola,%20quisiera%20activar%20mi%20cuenta%20de%20Kavas%20App.`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        padding: '16px 24px',
                                        background: '#10B981',
                                        color: 'white',
                                        borderRadius: '16px',
                                        textDecoration: 'none',
                                        fontWeight: 800,
                                        fontSize: '1.1rem',
                                        boxShadow: '0 8px 16px rgba(16, 185, 129, 0.3)'
                                    }}
                                >
                                    <img src="/Whatsapp.svg" alt="WhatsApp" style={{ width: '20px', height: '20px' }} />
                                    Activar Ahora
                                </a>
                            </div>
                        </div>
                    </div>
                ) : (
                    <Outlet />
                )}
            </main>

            <InventoryFab />

            {/* Modal personalizado con fondo naranja animado */}
            {showTrialModal && (
                <div
                    onClick={() => setShowTrialModal(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100000,
                        padding: '1rem',
                        animation: 'fadeIn 0.2s ease'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-card)',
                            borderRadius: '24px',
                            maxWidth: '500px',
                            width: '100%',
                            overflow: 'hidden',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                            animation: 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                            border: '1px solid rgba(255, 140, 0, 0.2)'
                        }}
                    >
                        {/* Header con gradiente y rayito */}
                        <div style={{
                            background: 'linear-gradient(135deg, #FF8C00 0%, #FF7900 100%)',
                            padding: '1rem 1rem',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Efecto de brillo */}
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2s infinite'
                            }} />

                            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                                {/* Rayito animado */}
                                <div style={{
                                    width: '50px',
                                    height: '50px',
                                    margin: '0 auto 0.5rem',
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                                    animation: 'pulse 2s ease-in-out infinite'
                                }}>
                                    <Zap size={24} color="white" fill="white" />
                                </div>
                                <h2 style={{
                                    color: 'white',
                                    fontSize: '1.35rem',
                                    fontWeight: 800,
                                    margin: '0 0 0.25rem 0',
                                    textShadow: '0 2px 10px rgba(0,0,0,0.2)'
                                }}>
                                    ¡Prueba Gratis por 7 Días!
                                </h2>
                                <p style={{
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '0.8rem',
                                    margin: 0
                                }}>
                                    Acceso completo sin compromiso
                                </p>
                            </div>
                        </div>

                        {/* Contenido */}
                        <div style={{ padding: '1rem 1rem' }}>
                            <h3 style={{
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                marginBottom: '0.6rem',
                                color: 'var(--text-primary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <div style={{ width: '3px', height: '12px', background: '#FF8C00', borderRadius: '3px' }} />
                                Beneficios incluidos
                            </h3>

                            {/* Lista de beneficios - Solo 4 beneficios principales */}
                            <div className="benefits-modal-grid" style={{
                                display: 'grid',
                                gap: '0.4rem',
                                marginBottom: '0.75rem'
                            }}>
                                {[
                                    { Icon: LayoutDashboard, text: 'Gestión de ventas y caja', mobile: true },
                                    { Icon: BarChart3, text: 'Reportes en tiempo real', mobile: true },
                                    { Icon: Package, text: 'Inventario inteligente', mobile: true },
                                    { Icon: Users2, text: 'Usuarios y permisos', mobile: true },
                                    { Icon: BadgeDollarSign, text: 'Precios y conversiones', mobile: false },
                                    { Icon: RefreshCw, text: 'Sincronización automática', mobile: false }
                                ].map((benefit, index) => (
                                    <div
                                        key={index}
                                        className={benefit.mobile ? '' : 'benefit-desktop-only'}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '0.45rem',
                                            background: 'var(--bg-card-hover)',
                                            borderRadius: '8px',
                                            border: '1px solid var(--accent-light)'
                                        }}
                                    >
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            background: 'rgba(255, 140, 0, 0.1)',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <benefit.Icon size={14} color="#FF8C00" strokeWidth={2.5} />
                                        </div>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            lineHeight: 1.2
                                        }}>
                                            {benefit.text}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Nota */}
                            <div style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: '8px',
                                padding: '0.6rem',
                                marginBottom: '0.75rem'
                            }}>
                                <p style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--text-secondary)',
                                    margin: 0,
                                    lineHeight: 1.3
                                }}>
                                    <strong style={{ color: '#10B981' }}>Nota:</strong> No necesitas tarjeta de crédito. Al finalizar podrás activar una licencia.
                                </p>
                            </div>

                            {/* Botones */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setShowTrialModal(false)}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--accent-light)',
                                        background: 'transparent',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmTrial}
                                    disabled={isActivating}
                                    style={{
                                        flex: 2,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #FF8C00 0%, #FF7900 100%)',
                                        color: 'white',
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 16px rgba(255, 140, 0, 0.4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Zap size={16} fill="white" />
                                    {isActivating ? 'Configurando...' : 'Activar Prueba'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <style>{`
                        .benefits-modal-grid {
                            grid-template-columns: repeat(2, 1fr);
                        }
                        @media (max-width: 640px) {
                            .benefits-modal-grid {
                                grid-template-columns: 1fr;
                            }
                            .benefit-desktop-only {
                                display: none !important;
                            }
                        }
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes bounceIn {
                            0% { transform: scale(0.3); opacity: 0; }
                            50% { transform: scale(1.05); }
                            70% { transform: scale(0.9); }
                            100% { transform: scale(1); opacity: 1; }
                        }
                        @keyframes shimmer {
                            0% { background-position: -200% center; }
                            100% { background-position: 200% center; }
                        }
                        @keyframes pulse {
                            0%, 100% { transform: scale(1); }
                            50% { transform: scale(1.05); }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
