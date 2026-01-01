import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { Store, Eye, EyeOff, PartyPopper } from 'lucide-react';
import './SalesPage.css';

export default function Register() {
    const navigate = useNavigate();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [liquorStoreName, setLiquorStoreName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // 1. Validación: si es dueño, debe tener nombre de licorería
        if (isOwner && !liquorStoreName.trim()) {
            setError('El nombre de la licorería es obligatorio para dueños.');
            setLoading(false);
            return;
        }

        try {
            // 2. Preparamos la metadata
            const metadata = {
                full_name: fullName,
                // Solo incluir liquor_store_name si es dueño
                liquor_store_name: isOwner ? liquorStoreName.trim() : null,
            };

            console.log('Enviando registro a Supabase:', metadata);

            // 3. Enviamos a Supabase con URL de redirección explícita
            const redirectTo = window.location.origin + '/login';

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: metadata,
                    emailRedirectTo: redirectTo
                },
            });

            if (authError) throw authError;

            // 4. Lógica Manual de Respaldo por si el Trigger falla o es lento
            // Si hay sesión activa (porque Email Confirm está apagado o es auto-login)
            if (authData.session && isOwner && liquorStoreName) {
                const userId = authData.user.id;

                // A. Crear Organización SIN LICENCIA ACTIVA
                const { data: orgData, error: orgError } = await supabase
                    .from('organizations')
                    .insert([{
                        name: liquorStoreName,
                        is_active: false,              // Sin licencia
                        trial_started_at: null,        // Sin trial
                        plan_type: null                // Sin plan
                    }])
                    .select()
                    .single();

                if (!orgError && orgData) {
                    // B. Actualizar Perfil para ser Master de esa Org
                    await supabase
                        .from('profiles')
                        .update({
                            role: 'master',
                            organization_id: orgData.id
                        })
                        .eq('id', userId);
                }
            }

            // 5. Éxito
            setShowSuccess(true);

        } catch (err) {
            console.error("Error en registro:", err);
            setError(err.message || 'Ocurrió un error al registrarse.');
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
                        width: '64px', height: '64px',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 1.5rem auto'
                    }}>
                        <img src="/KavasAppLogo.svg" alt="Kavas App Logo" style={{ width: '100%', height: '100%' }} />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Crear Cuenta</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Únete a la plataforma</p>
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
                    <div className="input-group-large">
                        <input
                            type="text"
                            placeholder="Nombre Completo"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            className="ticket-input-large"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div className="input-group-large">
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="ticket-input-large"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ position: 'relative', width: '100%', marginBottom: '1.25rem' }}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="ticket-input-large"
                            style={{ width: '100%', boxSizing: 'border-box', paddingRight: '48px' }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px'
                            }}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    {/* Checkbox de Dueño */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '1rem', background: 'var(--bg-card-hover)', borderRadius: '16px',
                        border: isOwner ? '2px solid var(--accent-color)' : '1px solid var(--accent-light)',
                        cursor: 'pointer', transition: 'all 0.2s'
                    }} onClick={() => setIsOwner(!isOwner)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                background: isOwner ? 'var(--accent-color)' : 'var(--accent-light)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}>
                                <Store size={18} color={isOwner ? 'white' : 'var(--text-secondary)'} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Soy Dueño de Negocio</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Crear nueva licorería</span>
                            </div>
                        </div>
                        <div style={{
                            width: '20px', height: '20px', borderRadius: '50%',
                            border: isOwner ? '6px solid var(--accent-color)' : '2px solid var(--text-muted)',
                            background: isOwner ? 'white' : 'transparent',
                            transition: 'all 0.2s'
                        }}></div>
                    </div>

                    {isOwner && (
                        <div className="input-group-large" style={{ animation: 'fadeIn 0.3s' }}>
                            <input
                                type="text"
                                placeholder="Nombre de tu Licorería"
                                value={liquorStoreName}
                                onChange={(e) => setLiquorStoreName(e.target.value)}
                                required={isOwner}
                                className="ticket-input-large"
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    border: '2px solid var(--accent-color)',
                                    background: 'var(--bg-card-hover)'
                                }}
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary-gradient"
                        style={{ marginTop: '0.5rem' }}
                    >
                        {loading ? 'Registrando...' : 'Registrarse'}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    ¿Ya tienes cuenta?{' '}
                    <Link to="/login" style={{ color: 'var(--accent-color)', fontWeight: 700, textDecoration: 'none' }}>
                        Inicia Sesión
                    </Link>
                </div>
            </div>

            {/* Modal de Éxito */}
            {showSuccess && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2000, backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: '32px', padding: '2.5rem 2rem',
                        width: '100%', maxWidth: '360px', textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid var(--accent-light)'
                    }}>
                        <div style={{
                            background: 'rgba(249, 115, 22, 0.1)', width: '84px', height: '84px',
                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem auto'
                        }}>
                            <PartyPopper size={44} color="var(--accent-color)" />
                        </div>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>¡Casi listo!</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontWeight: 500 }}>Revisa tu correo electrónico para confirmar tu cuenta y poder iniciar sesión.</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="btn-primary-gradient"
                        >
                            Ir a Iniciar Sesión
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}