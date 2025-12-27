import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, ArrowLeft, Key } from 'lucide-react';
import './SalesPage.css';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const { resetPassword } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            await resetPassword(email);
            setSuccess(true);
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error al enviar el correo de recuperación.');
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
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>¿Olvidaste tu contraseña?</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontWeight: 500 }}>Te enviaremos un enlace para recuperarla</p>
                </div>

                {error && (
                    <div style={{
                        background: '#FEE2E2', color: '#991B1B', padding: '0.75rem',
                        borderRadius: '12px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {success ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1.25rem',
                            borderRadius: '16px', marginBottom: '1.5rem', fontSize: '0.95rem', fontWeight: 600,
                            border: '1px solid rgba(16, 185, 129, 0.2)'
                        }}>
                            ¡Correo enviado! Revisa tu bandeja de entrada para continuar.
                        </div>
                        <Link to="/login" style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            color: 'var(--accent-color)', fontWeight: 700, textDecoration: 'none'
                        }}>
                            <ArrowLeft size={18} /> Volver al Inicio Sesión
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="input-group-large">
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Mail size={20} color="#999" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="email"
                                    placeholder="Tu correo electrónico"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="ticket-input-large"
                                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '44px' }}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary-gradient"
                        >
                            {loading ? 'Enviando...' : 'Enviar enlace'}
                        </button>

                        <Link to="/login" style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem',
                            marginTop: '0.5rem'
                        }}>
                            <ArrowLeft size={18} /> Volver
                        </Link>
                    </form>
                )}
            </div>
        </div>
    );
}
