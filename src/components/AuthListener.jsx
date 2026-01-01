import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useNotification } from '../context/NotificationContext';

/**
 * Componente que escucha eventos globales de autenticación 
 * para mostrar notificaciones automáticas (ej: verificación de correo).
 */
export default function AuthListener() {
    const { showNotification } = useNotification();
    const navigate = useNavigate();

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Detectar inicio de sesión exitoso
            if (event === 'SIGNED_IN') {
                const hash = window.location.hash;

                // Caso 1: Confirmación de Correo (Signup)
                if (hash.includes('type=signup') || hash.includes('type=invite')) {
                    showNotification('¡Correo verificado con éxito! Bienvenido a Kavas App.', 'success');
                    // Limpiamos los tokens de la URL
                    window.history.replaceState(null, null, window.location.pathname);

                    // Redirigir al usuario a la página principal
                    setTimeout(() => {
                        navigate('/vender');
                    }, 500);
                }

                // Caso 2: Recuperación de Contraseña
                if (hash.includes('type=recovery')) {
                    showNotification('Enlace de recuperación validado.', 'success');
                    // Redirigir a la página de reset
                    window.history.replaceState(null, null, '/reset-password');
                    navigate('/reset-password');
                }
            }

            // Detectar cierre de sesión
            if (event === 'SIGNED_OUT') {
                // Redirigir al login cuando se cierra sesión
                navigate('/login');
            }
        });

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [showNotification, navigate]);

    return null;
}
