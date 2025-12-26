import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ShoppingBag, Receipt, ClipboardList, Settings, Shield } from 'lucide-react';
import InventoryFab from '../components/InventoryFab';
import { useAuth } from '../context/AuthContext';
import './MainLayout.css';

export default function MainLayout() {
    const { role } = useAuth();

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
                <Outlet />
            </main>

            <InventoryFab />
        </div>
    );
}
