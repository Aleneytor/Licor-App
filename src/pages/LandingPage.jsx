import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    ShoppingBag,
    Package,
    TrendingUp,
    Users,
    DollarSign,
    BarChart3,
    ChevronRight,
    Sparkles,
    Shield,
    Zap,
    Sun,
    Moon,
    Check,
    MessageCircle,
    Clock,
    Headphones
} from 'lucide-react';
import '../styles/LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('landingTheme');
        return saved ? saved === 'dark' : true; // Default to dark
    });

    const WHATSAPP_NUMBER = "584220131019";
    const whatsappMessage = "Hola, estoy interesado en Kavas App. ¿Podrían darme información sobre las licencias?";

    // Redirect authenticated users to the app
    useEffect(() => {
        if (user) {
            navigate('/vender');
        }
    }, [user, navigate]);

    // Handle theme changes
    useEffect(() => {
        localStorage.setItem('landingTheme', isDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-landing-theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const toggleTheme = () => {
        setIsDark(!isDark);
    };

    // Card data pool for rotation
    const cardDataPool = [
        { icon: ShoppingBag, label: 'Ventas Hoy', value: '$2,458' },
        { icon: ShoppingBag, label: 'Ventas Mes', value: '$45,320' },
        { icon: Package, label: 'Productos', value: '156' },
        { icon: Package, label: 'Stock Bajo', value: '12' },
        { icon: TrendingUp, label: 'Crecimiento', value: '+23%' },
        { icon: TrendingUp, label: 'Objetivo Mes', value: '87%' },
        { icon: DollarSign, label: 'Utilidad', value: '+15%' },
        { icon: DollarSign, label: 'Margen', value: '28%' },
        { icon: BarChart3, label: 'Ventas/Día', value: '43' },
        { icon: BarChart3, label: 'Top Producto', value: '#1' },
        { icon: Users, label: 'Clientes', value: '234' },
        { icon: Users, label: 'Nuevos Hoy', value: '+8' },
    ];

    const [cardData, setCardData] = useState([
        cardDataPool[0], // Ventas Hoy
        cardDataPool[2], // Productos
        cardDataPool[4], // Crecimiento
        cardDataPool[6], // Utilidad
        cardDataPool[8], // Ventas/Día
        cardDataPool[10], // Clientes
    ]);

    // Rotating business type text
    const businessTypes = ['licorería', 'bar', 'gastrobar', 'venta de licores'];
    const [currentBusinessType, setCurrentBusinessType] = useState(0);
    const [isSliding, setIsSliding] = useState(false);

    // Chat Simulation State
    const [visibleMessages, setVisibleMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const chatBodyRef = useRef(null);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTo({
                top: chatBodyRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [visibleMessages, isTyping]);

    const chatConversation = [
        { id: 1, sender: 'client', text: "Necesito agregar productos a mi inventario y no recuerdo como hacerlo 😅" },
        { id: 2, sender: 'support', text: "No te preocupes, nos pasa a todos. Dirígete al menú de ajustes y presiona el botón Inventario. ¡Avísame cuando estés ahí!" },
        { id: 3, sender: 'client', text: "Listo, ya entré" },
        { id: 4, sender: 'support', text: "¡Genial! Luego selecciona el tipo de cerveza que agregarás, presiona el botón (+) y guarda los cambios en el botón naranja: Guardar Cambios." },
        { id: 5, sender: 'client', text: "¡Perfecto! Ya pude lograrlo, mil gracias por la ayuda 🙌" }
    ];

    useEffect(() => {
        let isMounted = true;
        let currentMsgIndex = 0;

        const runSimulation = async () => {
            if (!isMounted) return;
            setVisibleMessages([]);
            currentMsgIndex = 0;

            while (currentMsgIndex < chatConversation.length && isMounted) {
                setIsTyping(true);
                await new Promise(resolve => setTimeout(resolve, 1500)); // Typing duration

                if (!isMounted) break;
                setIsTyping(false);

                const nextMsg = chatConversation[currentMsgIndex];
                setVisibleMessages(prev => [...prev, nextMsg]);
                currentMsgIndex++;

                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait before next message
            }

            if (isMounted) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Pause at end
                if (isMounted) runSimulation(); // Restart
            }
        };

        runSimulation();

        return () => {
            isMounted = false;
        };
    }, []);

    // Rotate business type text every 3 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setIsSliding(true);
            setTimeout(() => {
                setCurrentBusinessType((prev) => (prev + 1) % businessTypes.length);
                setIsSliding(false);
            }, 500); // Wait for slide-out animation
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    // Rotate card data every 4 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCardData(prevData => {
                return prevData.map(() => {
                    const randomIndex = Math.floor(Math.random() * cardDataPool.length);
                    return cardDataPool[randomIndex];
                });
            });
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    // Blur force field effect - blur cards near center
    useEffect(() => {
        const applyBlurForceField = () => {
            const cards = document.querySelectorAll('.floating-card');
            const heroContent = document.querySelector('.hero-content');

            if (!heroContent) return;

            const contentRect = heroContent.getBoundingClientRect();
            const contentCenterY = contentRect.top + contentRect.height / 2;
            const contentCenterX = contentRect.left + contentRect.width / 2;

            cards.forEach(card => {
                const cardRect = card.getBoundingClientRect();
                const cardCenterY = cardRect.top + cardRect.height / 2;
                const cardCenterX = cardRect.left + cardRect.width / 2;

                // Calculate distance from card to content center
                const distanceX = Math.abs(cardCenterX - contentCenterX);
                const distanceY = Math.abs(cardCenterY - contentCenterY);
                const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

                // Blur radius based on distance (closer = more blur)
                const blurRadius = 500; // pixels (increased for visibility)
                const maxBlur = 12; // px (increased for visibility)

                if (distance < blurRadius) {
                    const blurAmount = ((blurRadius - distance) / blurRadius) * maxBlur;
                    card.style.filter = `blur(${blurAmount}px)`;
                    card.style.opacity = 0.5;
                } else {
                    card.style.filter = 'blur(0px)';
                    card.style.opacity = 1;
                }
            });
        };

        // Apply on load, scroll and resize
        applyBlurForceField();

        // Small delay to ensure DOM is ready
        setTimeout(applyBlurForceField, 100);

        window.addEventListener('scroll', applyBlurForceField);
        window.addEventListener('resize', applyBlurForceField);

        return () => {
            window.removeEventListener('scroll', applyBlurForceField);
            window.removeEventListener('resize', applyBlurForceField);
        };
    }, []);

    // Mouse repel effect for floating cards
    useEffect(() => {
        const handleMouseMove = (e) => {
            const cards = document.querySelectorAll('.floating-card');

            cards.forEach(card => {
                const rect = card.getBoundingClientRect();
                const cardCenterX = rect.left + rect.width / 2;
                const cardCenterY = rect.top + rect.height / 2;

                const distanceX = e.clientX - cardCenterX;
                const distanceY = e.clientY - cardCenterY;
                const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

                const repelRadius = 150;

                if (distance < repelRadius) {
                    const force = (repelRadius - distance) / repelRadius;
                    const translateX = -distanceX * force * 0.3;
                    const translateY = -distanceY * force * 0.3;

                    card.style.transform = `translate(${translateX}px, ${translateY}px)`;
                } else {
                    card.style.transform = 'translate(0, 0)';
                }
            });
        };

        const heroVisual = document.querySelector('.hero-visual');
        if (heroVisual) {
            heroVisual.addEventListener('mousemove', handleMouseMove);
            heroVisual.addEventListener('mouseleave', () => {
                const cards = document.querySelectorAll('.floating-card');
                cards.forEach(card => {
                    card.style.transform = 'translate(0, 0)';
                });
            });
        }

        return () => {
            if (heroVisual) {
                heroVisual.removeEventListener('mousemove', handleMouseMove);
            }
        };
    }, []);

    const features = [
        {
            icon: ShoppingBag,
            title: 'Punto de Venta Inteligente',
            description: 'Interfaz rápida e intuitiva para gestionar ventas con múltiples precios y productos variados.',
            details: [
                'Múltiples precios: Al Mayor y Al Detal',
                'Productos variados (cajas mixtas)',
                'Métodos de pago flexibles',
                'Interfaz optimizada para velocidad'
            ]
        },
        {
            icon: Package,
            title: 'Control de Inventario',
            description: 'Seguimiento preciso de stock con soporte para unidades fraccionadas y reportes de mermas.',
            details: [
                'Seguimiento en tiempo real',
                'Unidades fraccionadas inteligentes',
                'Reporte de mermas y daños',
                'Alertas de stock bajo'
            ]
        },
        {
            icon: TrendingUp,
            title: 'Reportes en Tiempo Real',
            description: 'Dashboard completo con gráficos, ventas diarias y exportación a Excel.',
            details: [
                'Gráficos interactivos',
                'Exportación a Excel',
                'Análisis de ventas diarias',
                'Productos más vendidos'
            ]
        },
        {
            icon: DollarSign,
            title: 'Multimoneda',
            description: 'Soporte para USD y EUR con actualización automática de tasas de cambio.',
            details: [
                'Soporte para USD y EUR',
                'Tasas BCV actualizables',
                'Conversión automática',
                'Reportes en ambas monedas'
            ]
        },
        {
            icon: Users,
            title: 'Gestión de Usuarios',
            description: 'Control de roles y permisos para administradores, managers y empleados.',
            details: [
                'Roles personalizables',
                'Permisos granulares',
                'Sistema de invitaciones',
                'Auditoría de acciones'
            ]
        },
        {
            icon: BarChart3,
            title: 'Cuentas Abiertas',
            description: 'Gestión de consumo local con tickets y optimización automática de cierres.',
            details: [
                'Gestión de mesas/clientes',
                'Tickets visuales',
                'Cierre optimizado automático',
                'Historial de consumo'
            ]
        }
    ];

    return (
        <div className="landing-container">
            {/* Header with Logo */}
            <header className="landing-header">
                <img
                    src="/Kavas Logo Horizontal Blanco.svg"
                    alt="Kavas App"
                    className="header-logo"
                />
                <button
                    className="theme-toggle"
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                >
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </header>

            {/* Floating WhatsApp Button */}
            <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="whatsapp-float"
                aria-label="Contactar por WhatsApp"
            >
                <img src="/Whatsapp.svg" alt="WhatsApp" className="whatsapp-icon" />
                <span className="whatsapp-text">Conoce Más Detalles</span>
            </a>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-content">
                    <div className="hero-badge">
                        <Sparkles size={16} />
                        <span>Nueva versión 1.1 disponible</span>
                    </div>

                    <h1 className="hero-title">
                        El cerebro digital de tu
                        <div className="business-type-container">
                            <span className={`gradient-text business-type-rotate ${isSliding ? 'slide-out' : 'slide-in'}`}>
                                {businessTypes[currentBusinessType]}
                            </span>
                        </div>
                    </h1>

                    <p className="hero-description">
                        Gestiona ventas, inventario y finanzas desde cualquier dispositivo.
                        Diseñado específicamente para licorerías que buscan optimizar sus operaciones.
                    </p>

                    <div className="hero-buttons">
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/register')}
                        >
                            Crear Cuenta Gratis
                            <ChevronRight size={20} />
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={() => navigate('/login')}
                        >
                            Iniciar Sesión
                        </button>
                    </div>

                    <div className="hero-stats">
                        <div className="stat-item">
                            <Shield size={20} />
                            <span>100% Seguro</span>
                        </div>
                        <div className="stat-item">
                            <Zap size={20} />
                            <span>Súper Rápido</span>
                        </div>
                        <div className="stat-item">
                            <Users size={20} />
                            <span>Multi-usuario</span>
                        </div>
                    </div>
                </div>

                <div className="hero-visual">
                    <div className="floating-card card-1">
                        <div className="card-icon">
                            {React.createElement(cardData[0].icon, { size: 24 })}
                        </div>
                        <div className="card-content">
                            <div className="card-label">{cardData[0].label}</div>
                            <div className="card-value">{cardData[0].value}</div>
                        </div>
                    </div>

                    <div className="floating-card card-2">
                        <div className="card-icon">
                            {React.createElement(cardData[1].icon, { size: 24 })}
                        </div>
                        <div className="card-content">
                            <div className="card-label">{cardData[1].label}</div>
                            <div className="card-value">{cardData[1].value}</div>
                        </div>
                    </div>

                    <div className="floating-card card-3">
                        <div className="card-icon">
                            {React.createElement(cardData[2].icon, { size: 24 })}
                        </div>
                        <div className="card-content">
                            <div className="card-label">{cardData[2].label}</div>
                            <div className="card-value">{cardData[2].value}</div>
                        </div>
                    </div>

                    <div className="floating-card card-5">
                        <div className="card-icon">
                            {React.createElement(cardData[3].icon, { size: 24 })}
                        </div>
                        <div className="card-content">
                            <div className="card-label">{cardData[3].label}</div>
                            <div className="card-value">{cardData[3].value}</div>
                        </div>
                    </div>

                    <div className="floating-card card-6">
                        <div className="card-icon">
                            {React.createElement(cardData[4].icon, { size: 24 })}
                        </div>
                        <div className="card-content">
                            <div className="card-label">{cardData[4].label}</div>
                            <div className="card-value">{cardData[4].value}</div>
                        </div>
                    </div>

                    <div className="floating-card card-7">
                        <div className="card-icon">
                            {React.createElement(cardData[5].icon, { size: 24 })}
                        </div>
                        <div className="card-content">
                            <div className="card-label">{cardData[5].label}</div>
                            <div className="card-value">{cardData[5].value}</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <div className="section-header">
                    <h2 className="section-title">
                        Todo lo que necesitas en <span className="gradient-text">un solo lugar</span>
                    </h2>
                    <p className="section-description">
                        Herramientas profesionales diseñadas para maximizar la eficiencia de tu negocio
                    </p>
                </div>

                <div className="features-grid">
                    {features.map((feature, index) => (
                        <div key={index} className="feature-card">
                            <div className="feature-icon">
                                <feature.icon size={24} />
                            </div>
                            <h3 className="feature-title">{feature.title}</h3>
                            <p className="feature-description">{feature.description}</p>

                            <div className="feature-details">
                                <div className="feature-details-title">Incluye:</div>
                                <ul className="feature-details-list">
                                    {feature.details.map((detail, i) => (
                                        <li key={i}>
                                            <Check size={16} />
                                            {detail}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Support Section */}
            <section className="support-section">
                <div className="support-container">
                    <div className="support-content">
                        <div className="support-badge">
                            <MessageCircle size={18} />
                            <span>Soporte 100% Humano</span>
                        </div>
                        <h2 className="support-title">
                            ¿Tienes dudas? Estamos <span className="green-text">contigo</span> en cada paso
                        </h2>
                        <p className="support-description">
                            Nuestro equipo no solo conoce la tecnología, entiende tu negocio. Estamos listos para ayudarte a optimizar tu operación hoy mismo.
                        </p>

                        <div className="support-features">
                            <div className="support-feature-item">
                                <div className="feature-icon-circle">
                                    <Clock size={20} />
                                </div>
                                <div className="feature-text">
                                    <strong>Disponibilidad Total</strong>
                                    <span>Toda la semana de 8:00 AM a 12:00 MN</span>
                                </div>
                            </div>
                            <div className="support-feature-item">
                                <div className="feature-icon-circle">
                                    <Zap size={20} />
                                </div>
                                <div className="feature-text">
                                    <strong>Respuesta al Instante</strong>
                                    <span>Asistencia inmediata sin bots, trato directo</span>
                                </div>
                            </div>
                        </div>

                        <a
                            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-support-whatsapp"
                        >
                            <img src="/Whatsapp.svg" alt="WA" className="support-btn-icon" />
                            Hablar con un experto
                        </a>
                    </div>

                    <div className="support-visual">
                        <div className="support-glow"></div>
                        <div className="chat-mockup">
                            <div className="chat-header">
                                <div className="chat-user">
                                    <div className="chat-avatar-status">
                                        <img src="/vite.svg" alt="Support" className="chat-avatar-img" />
                                        <span className="status-dot"></span>
                                    </div>
                                    <div className="chat-user-info">
                                        <strong>Soporte Kavas</strong>
                                        <span>En línea ahora</span>
                                    </div>
                                </div>
                                <Headphones size={20} className="header-icon" />
                            </div>
                            <div className="chat-body" ref={chatBodyRef}>
                                {visibleMessages.map((msg) => (
                                    <div key={msg.id} className={`chat-message ${msg.sender}`}>
                                        <div className="message-bubble">
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {isTyping && (
                                    <div className="chat-message support">
                                        <div className="message-bubble typing">
                                            <span className="dot"></span>
                                            <span className="dot"></span>
                                            <span className="dot"></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="chat-footer">
                                <div className="chat-input-placeholder">Escribe un mensaje...</div>
                                <div className="chat-send-icon">
                                    <Zap size={18} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="cta-background-elements">
                    <div className="cta-circle cta-circle-1"></div>
                    <div className="cta-circle cta-circle-2"></div>
                    <div className="cta-circle cta-circle-3"></div>
                </div>

                <div className="cta-content">
                    <div className="cta-icons">
                        <div className="cta-icon-float cta-icon-1">
                            <ShoppingBag size={32} />
                        </div>
                        <div className="cta-icon-float cta-icon-2">
                            <TrendingUp size={32} />
                        </div>
                        <div className="cta-icon-float cta-icon-3">
                            <Package size={32} />
                        </div>
                    </div>

                    <h2 className="cta-title">¿Listo para transformar tu negocio?</h2>
                    <p className="cta-description">
                        Únete a las licorerías que ya están optimizando sus operaciones con Kavas
                    </p>
                    <div className="cta-buttons">
                        <button
                            className="btn-primary-large"
                            onClick={() => navigate('/register')}
                        >
                            Comenzar Gratis
                            <ChevronRight size={20} />
                        </button>
                        <button
                            className="btn-ghost"
                            onClick={() => navigate('/login')}
                        >
                            Ya tengo una cuenta
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-content">
                    <div className="footer-main">
                        <div className="footer-brand">
                            <div className="footer-logo-container">
                                <img
                                    src="/White Kavas Icon.svg"
                                    alt="Kavas"
                                    className="footer-logo"
                                />
                            </div>
                            <h3>Kavas App</h3>
                            <p>El cerebro digital que potencia tu negocio</p>
                        </div>
                    </div>

                    <div className="footer-grid">
                        <div className="footer-column">
                            <h4>Redes Sociales</h4>
                            <div className="social-links">
                                <a href="https://instagram.com/kavas.app" target="_blank" rel="noopener noreferrer" className="social-link">
                                    Instagram
                                </a>
                                <a href="https://facebook.com/kavas.app" target="_blank" rel="noopener noreferrer" className="social-link">
                                    Facebook
                                </a>
                            </div>
                        </div>
                        <div className="footer-column">
                            <h4>Contacto</h4>
                            <ul className="contact-list">
                                <li>WhatsApp: +58 422 013 1019</li>
                                <li>Email: soporte@kavas.app</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>© 2025 Kavas. Desarrollado con ❤️ para emprendedores.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
