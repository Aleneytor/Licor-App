import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Shield, Activity, MousePointer, Layout, Map, Filter, RefreshCcw } from 'lucide-react';

export default function DeveloperPage() {
    const { role, loading } = useAuth();
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [stats, setStats] = useState({ topElements: [], topPages: [] });
    const [viewMode, setViewMode] = useState('STATS'); // 'STATS' | 'HEATMAP'
    const [selectedPath, setSelectedPath] = useState(null); // For heating specific page

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
            .limit(2000); // Reasonable limit for now

        if (error) {
            console.error(error);
        } else {
            setEvents(data);
            processStats(data);
        }
    };

    useEffect(() => {
        if (role === 'DEVELOPER') {
            fetchEvents();
        }
    }, [role]);

    const processStats = (data) => {
        // 1. Top Buttons/Elements
        const elementCounts = {};
        const pageCounts = {};

        data.forEach(e => {
            if (e.event_type === 'CLICK' && e.element_text) {
                const key = `${e.element_text} (${e.path})`;
                elementCounts[key] = (elementCounts[key] || 0) + 1;
            }
            if (e.event_type === 'NAVIGATE' && e.path) {
                pageCounts[e.path] = (pageCounts[e.path] || 0) + 1;
            }
        });

        const topElements = Object.entries(elementCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const topPages = Object.entries(pageCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        setStats({ topElements, topPages });

        // Auto-select most popular path for heatmap if none selected
        if (!selectedPath && topPages.length > 0) {
            setSelectedPath(topPages[0][0]);
        }
    };

    if (loading) return <div>Cargando acceso de desarrollador...</div>;

    // Filter events for heatmap
    const heatmapPoints = events.filter(e =>
        e.event_type === 'CLICK' &&
        e.path === selectedPath &&
        e.x && e.y
    );

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', paddingBottom: '100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: '#000', color: '#0f0', padding: '12px', borderRadius: '12px' }}>
                    <Shield size={32} />
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Developer Console</h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Master User Analytics & Heatmaps</p>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <button
                    onClick={() => setViewMode('STATS')}
                    style={{
                        padding: '10px 20px', borderRadius: '8px',
                        background: viewMode === 'STATS' ? 'var(--text-primary)' : 'var(--bg-card)',
                        color: viewMode === 'STATS' ? 'var(--bg-card)' : 'var(--text-primary)',
                        border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '8px'
                    }}
                >
                    <Activity size={18} /> Estadísticas
                </button>
                <button
                    onClick={() => setViewMode('HEATMAP')}
                    style={{
                        padding: '10px 20px', borderRadius: '8px',
                        background: viewMode === 'HEATMAP' ? 'var(--text-primary)' : 'var(--bg-card)',
                        color: viewMode === 'HEATMAP' ? 'var(--bg-card)' : 'var(--text-primary)',
                        border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '8px'
                    }}
                >
                    <Map size={18} /> Heatmap (Mapa de Calor)
                </button>
                <button onClick={fetchEvents} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <RefreshCcw size={20} />
                </button>
            </div>

            {viewMode === 'STATS' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    {/* Top Pages */}
                    <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}>
                            <Layout size={20} color="#3b82f6" /> Páginas Más Visitadas
                        </h3>
                        {stats.topPages.map(([path, count], i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--accent-light)' }}>
                                <span style={{ fontWeight: 500 }}>{path}</span>
                                <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 700 }}>{count}</span>
                            </div>
                        ))}
                    </div>

                    {/* Top Actions */}
                    <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}>
                            <MousePointer size={20} color="#f59e0b" /> Botones Más Clickados
                        </h3>
                        {stats.topElements.map(([label, count], i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--accent-light)' }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{label}</span>
                                <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 700 }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {viewMode === 'HEATMAP' && (
                <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', minHeight: '600px' }}>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600 }}>Seleccionar Ruta:</span>
                        {stats.topPages.map(([path]) => (
                            <button
                                key={path}
                                onClick={() => setSelectedPath(path)}
                                style={{
                                    padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--accent-light)',
                                    background: selectedPath === path ? 'var(--text-primary)' : 'transparent',
                                    color: selectedPath === path ? 'var(--bg-card)' : 'var(--text-primary)',
                                    cursor: 'pointer', fontSize: '0.85rem'
                                }}
                            >
                                {path}
                            </button>
                        ))}
                    </div>

                    <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '600px',
                        border: '2px dashed var(--accent-light)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: '#f8fafc' // Light bg to see dots better
                    }}>
                        <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                            Mostrando {heatmapPoints.length} clicks para: {selectedPath} (Escalado relativo)
                        </div>

                        {heatmapPoints.map((pt, i) => {
                            // Simple scaling: Assume average mobile width ~390px if captured on mobile, or desktop.
                            // Better approach: Normalize X/Y by viewport_w/h recorded
                            // then project onto this container (assume container is 100% W x 600px H)

                            // Let's rely on raw relative percentages if possible, or just raw pixels if user on same device.
                            // Fallback: Use % logic.

                            const leftPct = pt.viewport_w ? (pt.x / pt.viewport_w) * 100 : 50;
                            const topPct = pt.viewport_h ? (pt.y / pt.viewport_h) * 100 : 50;

                            // Clamping top (since our container is fixed height, scroll might affect this)
                            // This is a naive visualization but enough for "Where they click".

                            return (
                                <div
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        left: `${leftPct}%`,
                                        top: `${topPct}%`,
                                        width: '20px',
                                        height: '20px',
                                        background: 'rgba(255, 0, 0, 0.3)',
                                        borderRadius: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        pointerEvents: 'none'
                                    }}
                                />
                            );
                        })}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'gray', marginTop: '1rem' }}>
                        Nota: La visualización del mapa de calor es aproximada y se basa en porcentajes relativos de la pantalla del usuario.
                    </p>
                </div>
            )}
        </div>
    );
}
