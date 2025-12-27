import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ShoppingBag, Receipt, ClipboardList, Settings, Shield } from 'lucide-react';
import InventoryFab from '../components/InventoryFab';
import { useAuth } from '../context/AuthContext';
import './MainLayout.css';

export default function MainLayout() {
    const { role, isLicenseActive } = useAuth();
    const location = useLocation();
    const isAjustes = location.pathname === '/ajustes';
    const isDeveloper = location.pathname === '/developer';

    const getBlockMessage = () => {
        const path = location.pathname;
        if (path.includes('vender')) return 'Para usar las funciones del menú Vender activa la licencia.';
        if (path.includes('caja')) return 'Para usar las funciones del menú Caja activa la licencia.';
        if (path.includes('pendientes')) return 'Para usar las funciones del menú Pendientes activa la licencia.';
        return 'Activa Licencias en el menú activación en Ajustes para continuar usando la aplicación.';
    };

    const navItems = [
        { path: '/vender', label: 'Vender', icon: ShoppingBag },
        { path: '/caja', label: 'Caja', icon: Receipt },
        { path: '/pendientes', label: 'Pendientes', icon: ClipboardList },
        { path: '/ajustes', label: 'Ajustes', icon: Settings },
    ];

    if (role === 'DEVELOPER') {
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

    return (
        <div className="layout-container">
            <nav className={`main-nav ${isCompact ? 'compact-wrapper' : ''}`}>
                <div className={`nav-pill ${isCompact ? 'compact' : ''}`}>
                    {navItems.map((item) => (
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

            <main className="main-content">
                {(isLicenseActive === false && !isAjustes && !isDeveloper) ? (
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
                            background: 'rgba(234, 88, 12, 0.1)',
                            border: '1px solid #f97316',
                            padding: '2rem',
                            borderRadius: '24px',
                            maxWidth: '400px'
                        }}>
                            <h2 style={{ color: '#f97316', marginBottom: '1rem' }}>Acceso Restringido</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                                {getBlockMessage()}
                            </p>
                            <NavLink
                                to="/ajustes?view=activation"
                                style={{
                                    display: 'inline-block',
                                    padding: '12px 24px',
                                    background: '#f97316',
                                    color: 'white',
                                    borderRadius: '12px',
                                    textDecoration: 'none',
                                    fontWeight: 600
                                }}
                            >
                                Activar Ahora
                            </NavLink>
                        </div>
                    </div>
                ) : (
                    <Outlet />
                )}
            </main>

            <InventoryFab />
        </div>
    );
}
