import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserCheck, Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react';

export default function RegistroEmpleado() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [inviteInfo, setInviteInfo] = useState(null);
    const [loadingInvite, setLoadingInvite] = useState(true);
    const [success, setSuccess] = useState(false);
    const [needsConfirmation, setNeedsConfirmation] = useState(false);

    const token = searchParams.get('token');

    // Verificar token al cargar la página
    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setError('Link de invitación inválido');
                setLoadingInvite(false);
                return;
            }

            try {
                const { data, error: fetchError } = await supabase
                    .from('organization_invites')
                    .select('*, organizations(name)')
                    .eq('token', token)
                    .eq('status', 'pending')
                    .single();

                if (fetchError || !data) {
                    setError('Esta invitación no existe, ya fue usada, o expiró');
                    setLoadingInvite(false);
                    return;
                }

                setInviteInfo(data);
                // Email is no longer pre-filled - user enters their own
                setLoadingInvite(false);
            } catch (err) {
                console.error(err);
                setError('Error al verificar la invitación');
                setLoadingInvite(false);
            }
        };

        verifyToken();
    }, [token]);

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Validations
            if (!email || !password || !confirmPassword) {
                throw new Error('Por favor completa todos los campos');
            }

            if (password !== confirmPassword) {
                throw new Error('Las contraseñas no coinciden');
            }

            // 1. Create user account with metadata
            const redirectTo = window.location.origin + '/login';
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        organization_id: inviteInfo.organization_id,
                        role: inviteInfo.role.toLowerCase(),
                        full_name: fullName,
                        invited: true
                    },
                    emailRedirectTo: redirectTo
                }
            });

            if (signUpError) throw signUpError;

            // 2. Mark invitation as accepted (Best effort)
            try {
                await supabase
                    .from('organization_invites')
                    .update({ status: 'accepted' })
                    .eq('token', token);
            } catch (inviteErr) {
                console.warn('Could not mark invite as accepted, but account was created:', inviteErr);
            }

            // 3. Check if confirmation is needed
            if (signUpData.user && !signUpData.session) {
                setNeedsConfirmation(true);
            }

            // Success!
            setSuccess(true);

        } catch (err) {
            console.error(err);
            setError(err.message || 'Error al crear la cuenta');
        } finally {
            setLoading(false);
        }
    };

    if (loadingInvite) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: 'var(--bg-app)', padding: '1rem'
            }}>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
                    Verificando invitación...
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: 'var(--bg-app)', padding: '1rem'
            }}>
                <div style={{
                    background: 'var(--bg-card)', padding: '2.5rem 2rem', borderRadius: '32px',
                    width: '100%', maxWidth: '450px',
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--accent-light)',
                    textAlign: 'center',
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.1)', width: '80px', height: '80px',
                        borderRadius: '50%', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 1.5rem auto'
                    }}>
                        <CheckCircle color="#10b981" size={40} />
                    </div>

                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
                        ¡Bienvenido al Equipo!
                    </h2>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                        Tu cuenta ha sido creada exitosamente.<br />
                        {needsConfirmation && (
                            <div style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                color: '#D97706',
                                padding: '15px',
                                borderRadius: '16px',
                                fontSize: '0.95rem',
                                marginTop: '15px',
                                marginBottom: '15px',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                textAlign: 'left',
                                fontWeight: 500
                            }}>
                                📧 <strong>¡IMPORTANTE!</strong><br />
                                Se ha enviado un correo de confirmación a <strong>{email}</strong>.<br /><br />
                                El registro no estará completo hasta que hagas clic en el enlace dentro del correo.
                            </div>
                        )}
                        <br />
                        Ahora eres parte de<br />
                        <strong style={{ color: 'var(--text-primary)', fontSize: '1.2rem' }}>
                            {inviteInfo?.organizations?.name || 'tu organización'}
                        </strong>
                    </p>

                    <button
                        onClick={() => window.location.href = '/login'}
                        className="btn-primary-gradient"
                        style={{
                            width: '100%',
                            padding: '1rem',
                            fontSize: '1.1rem',
                            borderRadius: '16px',
                            fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                        }}
                    >
                        Entrar a mi Cuenta
                    </button>

                    <style>{`
                        @keyframes fadeIn {
                            from { opacity: 0; transform: translateY(20px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    if (error && !inviteInfo) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: 'var(--bg-app)', padding: '1rem'
            }}>
                <div style={{
                    background: 'var(--bg-card)', padding: '2rem', borderRadius: '20px',
                    maxWidth: '400px', textAlign: 'center',
                    border: '1px solid var(--accent-light)'
                }}>
                    <AlertCircle size={48} color="#EF4444" style={{ margin: '0 auto 1rem' }} />
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                        Invitación Inválida
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        {error}
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            background: '#3B82F6',
                            color: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        Ir al inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: 'var(--bg-app)', padding: '1rem',
            transition: 'background var(--transition-smooth)'
        }}>
            <div style={{
                background: 'var(--bg-card)', padding: '2.5rem 2rem', borderRadius: '32px',
                width: '100%', maxWidth: '450px',
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
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        Registro de Empleado
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>
                        Te han invitado a unirte a <strong>{inviteInfo?.organizations?.name || 'una organización'}</strong>
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: '#FEE2E2', color: '#991B1B', padding: '0.75rem',
                        borderRadius: '12px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.85rem', marginLeft: '4px', fontWeight: 600 }}>
                            Nombre Completo
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <UserCheck size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '14px' }} />
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
                        <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.85rem', marginLeft: '4px', fontWeight: 600 }}>
                            Correo Electrónico
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Mail size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '14px' }} />
                            <input
                                type="email"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="ticket-input-large"
                                style={{ paddingLeft: '44px' }}
                            />
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                            Ingresa tu correo electrónico
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.85rem', marginLeft: '4px', fontWeight: 600 }}>
                            Contraseña
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Lock size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '14px' }} />
                            <input
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="ticket-input-large"
                                style={{ paddingLeft: '44px' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.85rem', marginLeft: '4px', fontWeight: 600 }}>
                            Confirmar Contraseña
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Lock size={20} color="var(--text-secondary)" style={{ position: 'absolute', left: '14px' }} />
                            <input
                                type="password"
                                placeholder="Repite tu contraseña"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
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
                        style={{ marginTop: '1rem' }}
                    >
                        {loading ? 'Creando cuenta...' : 'Crear Cuenta y Unirse'}
                    </button>
                </form>
            </div>
        </div>
    );
}
