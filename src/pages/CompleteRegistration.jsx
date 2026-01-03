import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserCheck, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CompleteRegistration() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth(); // User should be logged in via Magic Link
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Get organization details from URL params
    const orgId = searchParams.get('org_id');
    const role = searchParams.get('role') || 'EMPLOYEE';
    const orgName = searchParams.get('org_name') || 'Organización';

    useEffect(() => {
        // Pre-fill name from user metadata if available
        if (user?.user_metadata?.full_name) {
            setFullName(user.user_metadata.full_name);
        }
    }, [user]);

    const handleComplete = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (!user) throw new Error("No hay sesión activa. Por favor usa el enlace de tu correo nuevamente.");

            if (!orgId) throw new Error("Información de organización no encontrada. Por favor contacta al administrador.");

            // 1. Update Password
            const { error: passError } = await supabase.auth.updateUser({
                password: password
            });
            if (passError) throw passError;

            // 2. Update Profile Name and link to organization
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    organization_id: orgId,
                    role: role.toLowerCase()
                })
                .eq('id', user.id);

            if (profileError) {
                console.error("Error actualizando perfil:", profileError);
                throw new Error("Error al actualizar el perfil. Por favor intenta nuevamente.");
            }

            // 3. Mark invite as accepted by updating status
            await supabase
                .from('organization_invites')
                .update({ status: 'accepted' })
                .eq('email', user.email)
                .eq('organization_id', orgId);

            alert(`¡Cuenta configurada con éxito! Ahora eres parte de ${decodeURIComponent(orgName)}`);

            // Reload to update auth context with new organization and role
            window.location.href = '/';

        } catch (err) {
            console.error(err);
            setError(err.message || "Error al completar registro.");
        } finally {
            setLoading(false);
        }
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
