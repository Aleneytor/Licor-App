import React, { useState, useEffect } from 'react';
// import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CompleteRegistration() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth(); // User should be logged in via Magic Link
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // If no user is found after a short delay (auth state loading), we might want to redirect to login.
        // For now, we assume useAuth handles the initial load.
        // If user is already fully set up (has password?), technically they could reuse this page to reset, but let's assume it's for new invites.

        // Try to pre-fill name if available (unlikely for magic link invite)
    }, [user]);

    const handleComplete = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // MOCK COMPLETE
        setTimeout(() => {
            alert('¡Cuenta configurada con éxito!');
            navigate('/');
        }, 1000);

        /*
        try {
            if (!user) throw new Error("No hay sesión activa. Por favor usa el enlace de tu correo nuevamente.");

            // 1. Update Password
            const { error: passError } = await supabase.auth.updateUser({
                password: password
            });
            if (passError) throw passError;

            // 2. Update Profile Name
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ full_name: fullName })
                .eq('id', user.id);

            if (profileError) {
                console.warn("Error actualizando nombre:", profileError);
                // Non-blocking error, but good to know
            }

            // 3. Delete the invite (Consume it) - Optional cleanup
            // We can delete by email
            await supabase
                .from('organization_invites')
                .delete()
                .eq('email', user.email);

            alert('¡Cuenta configurada con éxito!');
            navigate('/'); // Go to dashboard

        } catch (err) {
            console.error(err);
            setError(err.message || "Error al completar registro.");
        } finally {
            setLoading(false);
        }
        */
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: 'var(--bg-app)', padding: '1rem',
            transition: 'background var(--transition-smooth)'
        }}>
            <div style={{
                background: 'var(--bg-card)', padding: '2.5rem 2rem', borderRadius: '32px',
                width: '100%', maxWidth: '400px',
                boxShadow: 'var(--shadow-soft)',
                border: '1px solid var(--accent-light)',
                transition: 'all var(--transition-smooth)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        background: 'rgba(52, 199, 89, 0.1)', width: '56px', height: '56px',
                        borderRadius: '16px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 1.5rem auto'
                    }}>
                        <UserCheck color="#34c759" size={28} />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Completar Registro</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Configura tu cuenta para continuar</p>
                </div>

                {error && (
                    <div style={{
                        background: '#FEE2E2', color: '#991B1B', padding: '0.75rem',
                        borderRadius: '12px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleComplete} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.85rem', marginLeft: '4px', fontWeight: 600 }}>Nombre Completo</div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <User size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '14px' }} />
                            <input
                                type="text"
                                placeholder="Ej: Juan Pérez"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                                className="ticket-input-large"
                                style={{ paddingLeft: '44px' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.85rem', marginLeft: '4px', fontWeight: 600 }}>Nueva Contraseña</div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Lock size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '14px' }} />
                            <input
                                type="password"
                                placeholder="********"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="ticket-input-large"
                                style={{ paddingLeft: '44px' }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary-gradient"
                        style={{ marginTop: '1.5rem' }}
                    >
                        {loading ? 'Guardando...' : 'Finalizar Registro'}
                    </button>
                </form>

                {!user && (
                    <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        Esperando autenticación... <br />
                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>(Si no carga, vuelve a hacer clic en el correo)</span>
                    </div>
                )}
            </div>
        </div>
    );
}
