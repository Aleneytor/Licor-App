import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Clock, X, Zap, AlertTriangle } from 'lucide-react';

const DISMISS_KEY = 'freeTrialReminderDismissedUntil';

/**
 * FreeTrialReminder - Muestra un banner para usuarios en período de prueba
 * indicando cuántos días les quedan de su trial de 7 días.
 */
export default function FreeTrialReminder() {
    const { planType, licenseExpiresAt, isLicenseActive, role, organizationId } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // NUEVO: Ocultar si estamos en el menú de activación
    const params = new URLSearchParams(location.search);
    const isActivationView = params.get('view') === 'activation';

    const [dismissed, setDismissed] = useState(() => {
        // Verificar si fue dismisseado hoy
        const dismissedUntil = localStorage.getItem(DISMISS_KEY);
        if (dismissedUntil) {
            const dismissDate = new Date(dismissedUntil);
            if (dismissDate > new Date()) {
                return true;
            }
            // Expiró, limpiar
            localStorage.removeItem(DISMISS_KEY);
        }
        return false;
    });
    const [daysLeft, setDaysLeft] = useState(null);
    const [isInTrial, setIsInTrial] = useState(false);
    const [showTrialModal, setShowTrialModal] = useState(false);

    // Calcular días restantes (trial de 7 días o licencia)
    useEffect(() => {
        const calculateDaysLeft = async () => {
            if (!organizationId) return;

            // Obtener info de la organización
            const { data: org, error } = await supabase
                .from('organizations')
                .select('trial_started_at, is_active, license_expires_at')
                .eq('id', organizationId)
                .single();

            if (error || !org) return;

            // Si tiene trial activo (no tiene licencia activa pero tiene trial_started_at)
            if (org.trial_started_at && !org.is_active) {
                const trialStart = new Date(org.trial_started_at);
                const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 días
                const now = new Date();
                const diffTime = trialEnd - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                setDaysLeft(diffDays);
                setIsInTrial(true);
            }
            // Si tiene licencia free con expiración
            else if (licenseExpiresAt && planType === 'free') {
                const expiryDate = new Date(licenseExpiresAt);
                const now = new Date();
                const diffTime = expiryDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                setDaysLeft(diffDays);
                setIsInTrial(false);
            }
        };

        calculateDaysLeft();
    }, [organizationId, licenseExpiresAt, planType]);

    // Handler para dismiss con persistencia
    const handleDismiss = () => {
        // No mostrar hasta mañana a las 6am
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(6, 0, 0, 0);
        localStorage.setItem(DISMISS_KEY, tomorrow.toISOString());
        setDismissed(true);
    };

    // No mostrar si el usuario cerró el banner o si es developer
    const isFree = planType?.toLowerCase() === 'free';
    const isDeveloper = role?.toUpperCase() === 'DEVELOPER';

    // Mostrar si:
    // 1. Está en trial de 7 días (isInTrial = true), O
    // 2. Tiene plan free con expiración, O
    // 3. NO tiene licencia activa y NO está en trial (para poder activar trial)
    const shouldShow = !isDeveloper && !dismissed && !isActivationView && (
        (isInTrial && daysLeft !== null) ||  // Tiene trial activo
        (isFree && isLicenseActive && daysLeft !== null) || // Tiene plan free
        (!isLicenseActive && !isInTrial) // NO tiene licencia NI trial
    );

    if (!shouldShow) {
        return null;
    }

    // Determinar estilo según días restantes
    const isUrgent = daysLeft !== null && daysLeft <= 3;
    const isWarning = daysLeft !== null && daysLeft <= 7 && daysLeft > 3;

    const getProgressColor = () => {
        if (isUrgent) return '#ef4444'; // Rojo urgent
        if (isWarning || daysLeft === null || daysLeft <= 0) return '#FA852B'; // Naranja de marca (ahora también para restringido)
        return '#3b82f6'; // Azul
    };

    const getMessage = () => {
        if (daysLeft === null || daysLeft <= 0) return 'Acceso Restringido';
        if (daysLeft === 1) return '¡Último día de prueba!';
        if (daysLeft <= 3) return `¡Solo ${daysLeft} días restantes!`;
        if (isInTrial) return `Prueba gratuita: ${daysLeft} días restantes`;
        return `${daysLeft} días restantes de tu plan gratuito`;
    };

    const getIcon = () => {
        if (isUrgent) return AlertTriangle;
        if (daysLeft === null || daysLeft <= 0) return AlertTriangle;
        return Clock;
    };

    const Icon = getIcon();
    const progressPercent = daysLeft === null || daysLeft <= 0 ? 100 : Math.max(0, Math.min(100, ((30 - daysLeft) / 30) * 100));

    // Detectar si es móvil
    const isMobile = window.innerWidth < 640;

    return (
        <div style={{
            background: isUrgent
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)'
                : (isWarning || daysLeft === null || daysLeft <= 0)
                    ? 'linear-gradient(135deg, rgba(250, 133, 43, 0.15) 0%, rgba(250, 133, 43, 0.1) 100%)'
                    : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
            border: `1px solid ${isUrgent ? 'rgba(239, 68, 68, 0.3)' : (isWarning || daysLeft === null || daysLeft <= 0) ? 'rgba(250, 133, 43, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
            borderRadius: isMobile ? '12px' : '16px',
            padding: isMobile ? '10px 12px' : '12px 16px',
            marginBottom: '1rem',
            position: 'relative',
            overflow: 'hidden',
            animation: (isUrgent || daysLeft === null || daysLeft <= 0) ? 'pulseUrgent 2s ease-in-out infinite' : 'none'
        }}>
            {/* Barra de progreso */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '3px',
                width: `${progressPercent}%`,
                background: getProgressColor(),
                transition: 'width 0.5s ease',
                borderRadius: '0 2px 2px 0'
            }} />

            <div style={{
                display: 'flex',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: isMobile ? '8px' : '12px',
                flexDirection: isMobile ? 'column' : 'row',
                width: '100%'
            }}>
                {/* Icono y mensaje */}
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', flex: 1, minWidth: 0 }}>
                    <div style={{
                        width: isMobile ? '32px' : '36px',
                        height: isMobile ? '32px' : '36px',
                        borderRadius: isMobile ? '8px' : '10px',
                        background: getProgressColor(),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 4px 12px ${getProgressColor()}40`
                    }}>
                        <Icon size={isMobile ? 16 : 18} color="white" />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                        <span style={{
                            fontSize: isMobile ? '0.75rem' : '0.85rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: isMobile ? 'nowrap' : 'normal'
                        }}>
                            {getMessage()}
                        </span>
                        {!isMobile && (
                            <span style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)',
                                opacity: 0.8,
                                lineHeight: 1.2
                            }}>
                                {!isLicenseActive && !isInTrial
                                    ? 'Para usar las funciones del menú activa la licencia.'
                                    : isUrgent
                                        ? '¡Activa ahora para no perder acceso!'
                                        : isWarning
                                            ? 'Activa un plan para continuar'
                                            : 'Activa un plan premium'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Botones */}
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? '8px' : '10px',
                    width: isMobile ? '100%' : 'auto',
                    flexShrink: 0
                }}>
                    {/* Botón Principal: Probar 7 Días (solo si NO está en trial) */}
                    {!isInTrial && (
                        <button
                            onClick={() => setShowTrialModal(true)}
                            style={{
                                background: 'linear-gradient(135deg, #FF8C00 0%, #FF7900 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: isMobile ? '10px' : '12px',
                                padding: isMobile ? '10px 16px' : '10px 20px',
                                fontSize: isMobile ? '0.85rem' : '0.9rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 16px rgba(255, 140, 0, 0.4)',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                flex: isMobile ? '1' : '0 0 auto'
                            }}
                        >
                            <Zap size={isMobile ? 16 : 18} fill="white" />
                            Probar 7 Días
                        </button>
                    )}

                    {/* Botón Secundario: Activar Ahora (WhatsApp) */}
                    <button
                        onClick={() => {
                            const message = isInTrial
                                ? 'Hola, estoy en el período de prueba y quisiera conseguir mi licencia de Kavas App.'
                                : 'Hola, quisiera conseguir mi licencia de Kavas App.';
                            window.open(`https://wa.me/584220131019?text=${encodeURIComponent(message)}`, '_blank');
                        }}
                        style={{
                            background: '#10B981',
                            color: 'white',
                            border: 'none',
                            borderRadius: isMobile ? '10px' : '12px',
                            padding: isMobile ? '10px 16px' : '10px 20px',
                            fontSize: isMobile ? '0.85rem' : '0.9rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: isMobile ? '6px' : '8px',
                            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap',
                            flex: isMobile ? '1' : '0 0 auto'
                        }}
                    >
                        <img src="/Whatsapp.svg" alt="WhatsApp" style={{ width: isMobile ? '16px' : '18px', height: isMobile ? '16px' : '18px' }} />
                        Activar Ahora
                    </button>
                </div>
            </div>

            {/* CSS Animation */}
            <style>{`
                @keyframes pulseUrgent {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.85; }
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
            `}</style>

            {/* Modal de Confirmación de Trial */}
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
                            padding: '2rem 1.5rem',
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
                                    width: '80px',
                                    height: '80px',
                                    margin: '0 auto 1rem',
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                                    animation: 'pulse 2s ease-in-out infinite'
                                }}>
                                    <Zap size={40} color="white" fill="white" />
                                </div>
                                <h2 style={{
                                    color: 'white',
                                    fontSize: '1.75rem',
                                    fontWeight: 800,
                                    margin: '0 0 0.5rem 0',
                                    textShadow: '0 2px 10px rgba(0,0,0,0.2)'
                                }}>
                                    ¡Prueba Gratis por 7 Días!
                                </h2>
                                <p style={{
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '0.95rem',
                                    margin: 0
                                }}>
                                    Acceso completo sin compromiso
                                </p>
                            </div>
                        </div>

                        {/* Contenido */}
                        <div style={{ padding: '2rem 1.5rem' }}>
                            <h3 style={{
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                marginBottom: '1.25rem',
                                color: 'var(--text-primary)'
                            }}>
                                Beneficios incluidos:
                            </h3>

                            {/* Lista de beneficios */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                                {[
                                    { icon: '✨', text: 'Gestión completa de ventas y caja' },
                                    { icon: '📊', text: 'Reportes y estadísticas en tiempo real' },
                                    { icon: '📦', text: 'Control de inventario inteligente' },
                                    { icon: '👥', text: 'Gestión de usuarios y permisos' },
                                    { icon: '💰', text: 'Precios dinámicos y conversiones' },
                                    { icon: '🔄', text: 'Sincronización automática entre dispositivos' }
                                ].map((benefit, index) => (
                                    <div key={index} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '0.75rem',
                                        background: 'var(--bg-card-hover)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--accent-light)'
                                    }}>
                                        <span style={{ fontSize: '1.5rem' }}>{benefit.icon}</span>
                                        <span style={{
                                            fontSize: '0.95rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)'
                                        }}>
                                            {benefit.text}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Nota */}
                            <div style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '12px',
                                padding: '1rem',
                                marginBottom: '1.5rem'
                            }}>
                                <p style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    margin: 0,
                                    lineHeight: 1.5
                                }}>
                                    <strong style={{ color: '#3b82f6' }}>Nota:</strong> No necesitas tarjeta de crédito. Al finalizar el período de prueba, podrás activar una licencia para continuar usando el sistema.
                                </p>
                            </div>

                            {/* Botones */}
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setShowTrialModal(false)}
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--accent-light)',
                                        background: 'transparent',
                                        color: 'var(--text-secondary)',
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            if (!organizationId) {
                                                const { data: { user } } = await supabase.auth.getUser();
                                                if (!user) return;
                                                const { data: profile } = await supabase
                                                    .from('profiles')
                                                    .select('organization_id')
                                                    .eq('id', user.id)
                                                    .single();
                                                if (!profile?.organization_id) {
                                                    alert('No se pudo encontrar tu organización. Por favor contacta a soporte.');
                                                    return;
                                                }
                                                // Usar el ID encontrado
                                                const { error } = await supabase
                                                    .from('organizations')
                                                    .update({
                                                        trial_started_at: new Date().toISOString(),
                                                        is_active: false,
                                                        plan_type: 'free'
                                                    })
                                                    .eq('id', profile.organization_id);

                                                if (error) throw error;
                                            } else {
                                                const { error } = await supabase
                                                    .from('organizations')
                                                    .update({
                                                        trial_started_at: new Date().toISOString(),
                                                        is_active: false,
                                                        plan_type: 'free'
                                                    })
                                                    .eq('id', organizationId);

                                                if (error) throw error;
                                            }

                                            // En lugar de reload, usamos el contexto si es posible
                                            window.location.reload();
                                        } catch (err) {
                                            console.error('Error activating trial:', err);
                                            alert('Error al activar: ' + (err.message || 'Error desconocido'));
                                        }
                                    }}
                                    style={{
                                        flex: 2,
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #FF8C00 0%, #FF7900 100%)',
                                        color: 'white',
                                        fontSize: '1rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 16px rgba(255, 140, 0, 0.4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Zap size={20} fill="white" />
                                    Activar Prueba Gratis
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
