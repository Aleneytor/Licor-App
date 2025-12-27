import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Shield, Activity, MousePointer, Layout, Map, RefreshCcw, Key, Copy, Plus, Trash2, Lock, X, CheckCircle2 } from 'lucide-react';

export default function DeveloperPage() {
    const { role, loading } = useAuth();
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [stats, setStats] = useState({ topElements: [], topPages: [] });
    const [viewMode, setViewMode] = useState('STATS'); // 'STATS' | 'HEATMAP' | 'LICENSE'
    const [selectedPath, setSelectedPath] = useState(null);
    const [generatedKeys, setGeneratedKeys] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [genPlan, setGenPlan] = useState('monthly'); // 'monthly' | 'yearly' | 'free'
    const [copiedId, setCopiedId] = useState(null);

    // MFA States
    const [mfaEnrolled, setMfaEnrolled] = useState(false);
    const [showMfaEnroll, setShowMfaEnroll] = useState(false);
    const [mfaData, setMfaData] = useState(null);
    const [showMfaVerify, setShowMfaVerify] = useState(false);
    const [showMfaIntro, setShowMfaIntro] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [mfaError, setMfaError] = useState('');

    useEffect(() => {
        if (!loading && role !== 'DEVELOPER') {
            navigate('/');
        }
    }, [role, loading, navigate]);

    const fetchEvents = async () => {
        const { data, error } = await supabase
            .from('analytics_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(2000);

        if (!error && data) {
            setEvents(data);
            processStats(data);
        }
    };

    const fetchKeys = async () => {
        const { data, error } = await supabase
            .from('license_keys')
            .select('*, organizations:used_by_org_id(name, license_expires_at)')
            .order('created_at', { ascending: false });
        if (!error) setGeneratedKeys(data || []);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const isExpiringSoon = (dateStr) => {
        if (!dateStr) return false;
        const expiry = new Date(dateStr);
        const now = new Date();
        const diff = expiry.getTime() - now.getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        return days <= 7 && days > 0;
    };

    const isExpired = (dateStr) => {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date();
    };

    const getDaysRemaining = (dateStr) => {
        if (!dateStr) return null;
        const expiry = new Date(dateStr);
        const now = new Date();
        const diff = expiry.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days;
    };

    const checkMfaStatus = async () => {
        if (!supabase.auth.mfa) return;
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (data?.all?.some(f => f.status === 'verified')) {
            setMfaEnrolled(true);
        }
    };

    useEffect(() => {
        if (role === 'DEVELOPER') {
            fetchEvents();
            fetchKeys();
            checkMfaStatus();
        }
    }, [role]);

    const startEnrollment = async () => {
        // SEGURIDAD: Si ya está enrolado, bloquear cualquier intento de generar nuevos secretos
        if (mfaEnrolled) {
            alert("Sistema Blindado: Tu cuenta ya tiene una seguridad activa. Por seguridad, no se permite generar nuevos seriales.");
            return;
        }

        // PREVENCIÓN: Bloquear antes de que Supabase intente usar criptografía si no es seguro
        if (!window.isSecureContext) {
            alert("⚠️ BLOQUEO POR SEGURIDAD:\n\nEl sistema de Google Authenticator no permite configurarse a través de una conexión no segura (HTTP) usando una dirección IP.\n\nSOLUCIÓN: Por favor, abre el sistema usando 'localhost' en esta computadora para configurar la seguridad por primera vez.");
            setShowMfaIntro(false);
            return;
        }

        if (!supabase.auth.mfa) {
            alert("Tu versión de Supabase SDK no soporta MFA. Actualiza @supabase/supabase-js.");
            return;
        }
        try {
            // 1. Limpiar intentos previos
            const { data: factors } = await supabase.auth.mfa.listFactors();
            if (factors?.all?.length > 0) {
                for (const f of factors.all) {
                    if (f.status === 'unverified') {
                        await supabase.auth.mfa.unenroll({ factorId: f.id });
                    }
                }
            }

            // 2. Iniciar nuevo enrolamiento (Solo TOTP)
            const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
            if (error) {
                alert("Error de Supabase: " + error.message);
                return;
            }
            if (data) {
                setMfaData(data);
                setShowMfaEnroll(true);
            }
        } catch (err) {
            console.error("MFA Error:", err);
            setShowMfaEnroll(false);
            setShowMfaIntro(false);
            alert("Error al conectar con el sistema de seguridad. Verifica tu conexión.");
        }
    };

    const confirmEnrollment = async () => {
        if (!mfaCode) return;
        setIsVerifying(true);
        setMfaError('');
        try {
            if (!mfaData?.id) throw new Error("No hay datos de enrolamiento activos.");
            const { data, error } = await supabase.auth.mfa.challenge({ factorId: mfaData.id });
            if (error) throw error;

            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: mfaData.id,
                challengeId: data.id,
                code: mfaCode
            });

            if (verifyError) throw verifyError;

            setMfaEnrolled(true);
            setShowMfaEnroll(false);
            setMfaCode('');
            setMfaData(null);
            alert("¡2FA configurado correctamente!");
        } catch (err) {
            setMfaError("Código incorrecto o expirado");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleGenerateClick = () => {
        if (!mfaEnrolled) {
            setShowMfaIntro(true);
            return;
        }
        setShowMfaVerify(true);
        setMfaCode('');
        setMfaError('');
    };

    const verifyAndGenerate = async () => {
        if (!mfaCode) return;
        setIsVerifying(true);
        setMfaError('');
        try {
            const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
            if (listError) throw listError;
            const factor = factors?.all?.find(f => f.status === 'verified');
            if (!factor) throw new Error("No se encontró un factor verificado.");

            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
            if (challengeError) throw challengeError;

            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: factor.id,
                challengeId: challengeData.id,
                code: mfaCode
            });

            if (verifyError) throw verifyError;

            setShowMfaVerify(false);
            setMfaCode('');
            await generateNewKey();
        } catch (err) {
            setMfaError("Código de seguridad inválido");
        } finally {
            setIsVerifying(false);
        }
    };

    const generateNewKey = async () => {
        setIsGenerating(true);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const part = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        const newKey = `KAV-${part()}-${part()}-${part()}`;

        const { error } = await supabase
            .from('license_keys')
            .insert([{
                key: newKey,
                status: 'available',
                plan_type: genPlan
            }]);

        if (error) {
            alert("Error: " + error.message);
        } else {
            fetchKeys();
        }
        setIsGenerating(false);
    };

    const deleteKey = async (id) => {
        if (!window.confirm("¿Borrar clave?")) return;
        await supabase.from('license_keys').delete().eq('id', id);
        fetchKeys();
    };

    const handleCopy = async (id, text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            // Fallback for non-secure contexts
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopiedId(id);
                setTimeout(() => setCopiedId(null), 2000);
            } catch (copyErr) {
                alert('No se pudo copiar la clave.');
            }
            document.body.removeChild(textArea);
        }
    };

    const processStats = (data) => {
        const elementCounts = {};
        const pageCounts = {};
        const elementUsers = {};
        const pageUsers = {};
        const totalUniqueUsers = new Set(data.map(e => e.user_id).filter(Boolean)).size || 1;
        let totalClicks = 0;
        let totalNavs = 0;

        data.forEach(e => {
            if (e.event_type === 'CLICK' && e.element_text) {
                const key = `${e.element_text} (${e.path})`;
                elementCounts[key] = (elementCounts[key] || 0) + 1;
                totalClicks++;
                if (!elementUsers[key]) elementUsers[key] = new Set();
                if (e.user_id) elementUsers[key].add(e.user_id);
            }
            if (e.event_type === 'NAVIGATE' && e.path) {
                pageCounts[e.path] = (pageCounts[e.path] || 0) + 1;
                totalNavs++;
                if (!pageUsers[e.path]) pageUsers[e.path] = new Set();
                if (e.user_id) pageUsers[e.path].add(e.user_id);
            }
        });

        const topElements = Object.entries(elementCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([label, count]) => ({
                label, count,
                pctActions: totalClicks > 0 ? ((count / totalClicks) * 100).toFixed(1) : 0,
                pctUsers: ((elementUsers[label].size / totalUniqueUsers) * 100).toFixed(1),
                userCount: elementUsers[label].size
            }));

        const topPages = Object.entries(pageCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([path, count]) => ({
                path, count,
                pctActions: totalNavs > 0 ? ((count / totalNavs) * 100).toFixed(1) : 0,
                pctUsers: ((pageUsers[path].size / totalUniqueUsers) * 100).toFixed(1),
                userCount: pageUsers[path].size
            }));

        setStats({ topElements, topPages });
        if (!selectedPath && topPages.length > 0) setSelectedPath(topPages[0].path);
    };

    if (loading) return <div>Cargando...</div>;

    const heatmapPoints = events.filter(e => e.event_type === 'CLICK' && e.path === selectedPath && e.x && e.y);

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', paddingBottom: '100px', minHeight: '100vh' }}>
            {/* Header section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #00ff88 0%, #00bd68 100%)',
                    color: '#000',
                    padding: '16px',
                    borderRadius: '20px',
                    boxShadow: '0 8px 24px rgba(0, 255, 136, 0.2)'
                }}>
                    <Shield size={32} />
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Developer Console</h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Sistemas de Control & Analíticas Avanzadas</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', background: 'var(--bg-card)', padding: '6px', borderRadius: '16px', width: 'fit-content', border: '1px solid var(--accent-light)' }}>
                {[
                    { id: 'STATS', icon: Activity, label: 'Panel Control' },
                    { id: 'HEATMAP', icon: Map, label: 'Mapa de Calor' },
                    { id: 'LICENSE', icon: Key, label: 'Gestión Licencias' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setViewMode(tab.id)}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '12px',
                            background: viewMode === tab.id ? 'var(--text-primary)' : 'transparent',
                            color: viewMode === tab.id ? 'var(--bg-card)' : 'var(--text-secondary)',
                            border: 'none',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'center',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        <tab.icon size={18} /> {tab.label}
                    </button>
                ))}
            </div>

            {viewMode === 'STATS' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--accent-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 0, fontSize: '1.3rem', marginBottom: '1.5rem' }}>
                            <Layout size={22} color="#3b82f6" /> Navegación de Páginas
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {stats.topPages.map((p, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ fontWeight: 500 }}>{p.path}</span>
                                    <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700 }}>{p.pctActions}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--accent-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 0, fontSize: '1.3rem', marginBottom: '1.5rem' }}>
                            <MousePointer size={22} color="#f59e0b" /> Interacciones (Clicks)
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {stats.topElements.map((e, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{e.label}</span>
                                    <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700 }}>{e.pctActions}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'HEATMAP' && (
                <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--accent-light)' }}>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '2rem', flexWrap: 'wrap' }}>
                        {stats.topPages.map(p => (
                            <button
                                key={p.path}
                                onClick={() => setSelectedPath(p.path)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '12px',
                                    background: selectedPath === p.path ? 'var(--text-primary)' : 'rgba(255,255,255,0.05)',
                                    color: selectedPath === p.path ? 'var(--bg-card)' : 'var(--text-primary)',
                                    border: '1px solid var(--accent-light)',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.9rem'
                                }}
                            >
                                {p.path}
                            </button>
                        ))}
                    </div>
                    <div style={{ position: 'relative', width: '100%', height: '600px', background: 'rgba(0,0,0,0.3)', borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--accent-light)' }}>
                        {heatmapPoints.map((pt, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                left: `${(pt.x / (pt.viewport_w || 1)) * 100}%`,
                                top: `${(pt.y / (pt.viewport_h || 1)) * 100}%`,
                                width: '20px', height: '20px',
                                background: 'radial-gradient(circle, #ff4444 0%, rgba(255, 68, 68, 0) 70%)',
                                opacity: 0.6,
                                borderRadius: '50%',
                                transform: 'translate(-50%, -50%)',
                                filter: 'blur(1px)'
                            }} />
                        ))}
                    </div>
                </div>
            )}

            {viewMode === 'LICENSE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    <div style={{
                        background: 'linear-gradient(90deg, var(--bg-card) 0%, rgba(255,255,255,0.03) 100%)',
                        padding: '2.5rem',
                        borderRadius: '24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid var(--accent-light)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                    }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Generar Licencia</h2>
                            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Formato Estándar: KAV-XXXX-XXXX-XXXX</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <div style={{
                                display: 'flex',
                                background: 'var(--accent-light)',
                                padding: '6px',
                                borderRadius: '16px',
                                border: '1px solid var(--accent-light)',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                                <button
                                    onClick={() => setGenPlan('free')}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: genPlan === 'free' ? '#00ff88' : 'transparent',
                                        color: genPlan === 'free' ? '#000' : 'var(--text-primary)',
                                        opacity: genPlan === 'free' ? 1 : 0.6,
                                        fontWeight: 800,
                                        transition: 'all 0.3s ease',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    FREE
                                </button>
                                <button
                                    onClick={() => setGenPlan('monthly')}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: genPlan === 'monthly' ? '#00ff88' : 'transparent',
                                        color: genPlan === 'monthly' ? '#000' : 'var(--text-primary)',
                                        opacity: genPlan === 'monthly' ? 1 : 0.6,
                                        fontWeight: 800,
                                        transition: 'all 0.3s ease',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    30 DÍAS
                                </button>
                                <button
                                    onClick={() => setGenPlan('yearly')}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: genPlan === 'yearly' ? '#00ff88' : 'transparent',
                                        color: genPlan === 'yearly' ? '#000' : 'var(--text-primary)',
                                        opacity: genPlan === 'yearly' ? 1 : 0.6,
                                        fontWeight: 800,
                                        transition: 'all 0.3s ease',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    1 AÑO
                                </button>
                            </div>
                            <button
                                onClick={handleGenerateClick}
                                disabled={isGenerating}
                                style={{
                                    padding: '16px 32px',
                                    background: 'linear-gradient(135deg, #00ff88 0%, #00bd68 100%)',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '16px',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center',
                                    fontSize: '1rem',
                                    boxShadow: '0 10px 25px rgba(0, 255, 136, 0.3)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}
                            >
                                <Plus size={22} strokeWidth={3} /> {isGenerating ? 'Generando...' : 'Generar Key'}
                            </button>
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--accent-light)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Licencia</th>
                                    <th style={{ textAlign: 'left', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Configuración</th>
                                    <th style={{ textAlign: 'left', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Organización</th>
                                    <th style={{ textAlign: 'left', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Vencimiento</th>
                                    <th style={{ textAlign: 'right', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {generatedKeys.map(k => {
                                    const daysLeft = getDaysRemaining(k.organizations?.license_expires_at);
                                    const isExp = isExpired(k.organizations?.license_expires_at);
                                    const isSoon = isExpiringSoon(k.organizations?.license_expires_at);

                                    return (
                                        <tr key={k.id} style={{ borderTop: '1px solid var(--accent-light)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <code style={{ background: 'rgba(0, 255, 136, 0.1)', padding: '8px 16px', borderRadius: '10px', fontSize: '1.1rem', color: '#00ff88', fontWeight: 800, letterSpacing: '2px', border: '1px solid rgba(0, 255, 136, 0.2)' }}>{k.key}</code>
                                                    <button
                                                        onClick={() => handleCopy(k.id, k.key)}
                                                        style={{
                                                            padding: '10px',
                                                            borderRadius: '10px',
                                                            border: `1px solid ${copiedId === k.id ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
                                                            background: copiedId === k.id ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255,255,255,0.05)',
                                                            cursor: 'pointer',
                                                            color: copiedId === k.id ? '#00ff88' : 'var(--text-primary)',
                                                            transition: 'all 0.2s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}
                                                        title="Copiar al portapapeles"
                                                    >
                                                        {copiedId === k.id ? (
                                                            <>
                                                                <Shield size={16} />
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>¡COPIADO!</span>
                                                            </>
                                                        ) : <Copy size={16} />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <span style={{
                                                        fontSize: '0.8rem',
                                                        padding: '4px 12px',
                                                        borderRadius: '20px',
                                                        background: k.status === 'available' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                        color: k.status === 'available' ? '#10b981' : '#f87171',
                                                        width: 'fit-content',
                                                        fontWeight: 800,
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {k.status === 'available' ? 'Disponible' : 'En Uso'}
                                                    </span>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: k.plan_type === 'yearly' ? '#3b82f6' : (k.plan_type === 'free' ? '#94a3b8' : '#f97316') }}></div>
                                                        Plazo: {k.plan_type === 'yearly' ? 'ANUAL' : (k.plan_type === 'free' ? 'Prueba Gratuita' : '30 Días')}
                                                    </span>
                                                    {k.status !== 'available' && k.used_at && (
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500, fontStyle: 'italic' }}>
                                                            Activada: {formatDate(k.used_at)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem' }}>
                                                {k.organizations?.name ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                                                {k.organizations.name.charAt(0)}
                                                            </div>
                                                            <span style={{ fontWeight: 600 }}>{k.organizations.name}</span>
                                                        </div>
                                                        {k.organizations.license_expires_at && (
                                                            <div style={{
                                                                fontSize: '0.75rem',
                                                                color: isExpired(k.organizations.license_expires_at) ? '#f87171' : (isExpiringSoon(k.organizations.license_expires_at) ? '#fbbf24' : 'var(--text-secondary)'),
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                fontWeight: (isExpired(k.organizations.license_expires_at) || isExpiringSoon(k.organizations.license_expires_at)) ? 'bold' : 'normal'
                                                            }}>
                                                                {isExpired(k.organizations.license_expires_at) ? '❌ Expirado: ' : (isExpiringSoon(k.organizations.license_expires_at) ? '⚠️ Próximo a vencer: ' : 'Vence: ')}
                                                                {formatDate(k.organizations.license_expires_at)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sin asignar</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '1.5rem' }}>
                                                {k.organizations?.license_expires_at ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isExp ? '#f87171' : (isSoon ? '#fbbf24' : 'var(--text-primary)') }}>
                                                            {formatDate(k.organizations.license_expires_at)}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.75rem',
                                                            fontWeight: 800,
                                                            color: isExp ? '#f87171' : (isSoon ? '#fbbf24' : '#10b981'),
                                                            background: isExp ? 'rgba(239, 68, 68, 0.1)' : (isSoon ? 'rgba(251, 191, 36, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            width: 'fit-content'
                                                        }}>
                                                            {isExp ? 'EXPIRADA' : `${daysLeft} DÍAS RESTANTES`}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '1.5rem', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => deleteKey(k.id)}
                                                    style={{
                                                        color: '#f87171',
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                                        cursor: 'pointer',
                                                        padding: '10px',
                                                        borderRadius: '10px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Enrolamiento 2FA */}
            {showMfaEnroll && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: '#1a1a1a', borderRadius: '32px', border: '1px solid #333', width: '95%', maxWidth: '450px', padding: 'min(2.5rem, 6vw)', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflowX: 'hidden' }}>
                        <button onClick={() => setShowMfaEnroll(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(0, 255, 136, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ff88', margin: '0 auto 1.5rem' }}>
                                <Lock size={32} />
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', color: 'white' }}>Seguridad Requerida</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6' }}>Copia este serial e ingrésalo en tu app de <b>Google Authenticator</b>.</p>

                            <div style={{ marginBottom: '2.5rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '20px', border: '1px solid #333' }}>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 800, marginBottom: '12px' }}>Serial de Configuración (Cereal):</p>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <code style={{
                                        background: 'rgba(0, 255, 136, 0.1)',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        color: '#00ff88',
                                        fontSize: 'min(1.2rem, 4vw)',
                                        fontWeight: 800,
                                        letterSpacing: '1px',
                                        border: '1px solid rgba(0, 255, 136, 0.2)',
                                        width: '100%',
                                        wordBreak: 'break-all',
                                        lineHeight: '1.4'
                                    }}>
                                        {mfaData?.totp?.secret || '--------'}
                                    </code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(mfaData?.totp?.secret);
                                            alert("¡Serial Copiado!");
                                        }}
                                        style={{
                                            background: 'rgba(0, 255, 136, 0.1)',
                                            border: '1px solid #00ff88',
                                            color: '#00ff88',
                                            padding: '10px 20px',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            fontWeight: 800,
                                            fontSize: '0.8rem',
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <Copy size={16} /> COPIAR SERIAL
                                    </button>
                                </div>
                            </div>

                            <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Código de Verificación</label>
                                <input
                                    type="text"
                                    placeholder="000000"
                                    maxLength={6}
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', borderRadius: '14px', padding: '16px', color: 'white', fontSize: '1.5rem', textAlign: 'center', letterSpacing: '8px', fontWeight: 'bold' }}
                                />
                                {mfaError && <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '8px', textAlign: 'center', fontWeight: 'bold' }}>{mfaError}</p>}
                            </div>

                            <button
                                onClick={confirmEnrollment}
                                disabled={mfaCode.length !== 6 || isVerifying}
                                style={{
                                    width: '100%',
                                    padding: '18px',
                                    background: '#00ff88',
                                    color: 'black',
                                    border: 'none',
                                    borderRadius: '16px',
                                    fontWeight: 900,
                                    cursor: mfaCode.length === 6 ? 'pointer' : 'not-allowed',
                                    opacity: mfaCode.length === 6 ? 1 : 0.5,
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}
                            >
                                {isVerifying ? 'Verificando...' : 'Confirmar Configuración'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Verificación 2FA para Generar */}
            {showMfaVerify && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: '#1a1a1a', borderRadius: '32px', border: '1px solid #333', width: '100%', maxWidth: '400px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <button onClick={() => setShowMfaVerify(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(0, 255, 136, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ff88', margin: '0 auto 1.5rem' }}>
                                <Shield size={32} />
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', color: 'white' }}>Seguridad Requerida</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>Ingresa el código de <b>Google Authenticator</b> para autorizar la generación de la licencia.</p>

                            <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="000000"
                                    maxLength={6}
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', borderRadius: '18px', padding: '20px', color: 'white', fontSize: '2rem', textAlign: 'center', letterSpacing: '8px', fontWeight: 'bold' }}
                                />
                                {mfaError && <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '12px', textAlign: 'center', fontWeight: 'bold' }}>{mfaError}</p>}
                            </div>

                            <button
                                onClick={verifyAndGenerate}
                                disabled={mfaCode.length !== 6 || isVerifying}
                                style={{
                                    width: '100%',
                                    padding: '20px',
                                    background: '#00ff88',
                                    color: 'black',
                                    border: 'none',
                                    borderRadius: '16px',
                                    fontWeight: 900,
                                    cursor: mfaCode.length === 6 ? 'pointer' : 'not-allowed',
                                    opacity: mfaCode.length === 6 ? 1 : 0.5,
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    boxShadow: '0 10px 25px rgba(0, 255, 136, 0.3)'
                                }}
                            >
                                {isVerifying ? 'Verificando...' : 'Autorizar y Generar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Introducción 2FA (Estético) */}
            {showMfaIntro && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: '#1a1a1a', borderRadius: '32px', border: '1px solid #333', width: '100%', maxWidth: '420px', padding: '2.5rem', textAlign: 'center', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(0, 255, 136, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ff88', margin: '0 auto 1.5rem' }}>
                            <Shield size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem', color: 'white' }}>Seguridad de Nivel 2</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
                            Para generar claves de licencia, es necesario vincular tu cuenta con <b>Google Authenticator</b>. Esto protege el sistema contra accesos no autorizados.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                onClick={() => {
                                    setShowMfaIntro(false);
                                    startEnrollment();
                                }}
                                style={{
                                    width: '100%',
                                    padding: '18px',
                                    background: '#00ff88',
                                    color: 'black',
                                    border: 'none',
                                    borderRadius: '16px',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    boxShadow: '0 10px 25px rgba(0, 255, 136, 0.3)'
                                }}
                            >
                                Configurar Ahora
                            </button>
                            <button
                                onClick={() => setShowMfaIntro(false)}
                                style={{
                                    width: '100%',
                                    padding: '18px',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    border: '1px solid #333',
                                    borderRadius: '16px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Tal vez después
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
