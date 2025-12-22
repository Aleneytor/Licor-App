import React, { useState } from 'react';
import { Database, Trash2, RefreshCw } from 'lucide-react';
import { generateFakeData, clearAllData } from '../utils/DevDataGenerator';

const DevTools = () => {
    const [isOpen, setIsOpen] = useState(false);

    // Only show in development if you want, or just keep it hidden/floating
    if (process.env.NODE_ENV === 'production' && !window.location.host.includes('localhost')) {
        // You can return null here to hide in production
        // But the user asked for "totalmente removible", so we'll keep it active for now
        // so they can test it in their current environment.
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '80px', // Above the main nav
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '12px'
        }}>
            {isOpen && (
                <div style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(12px)',
                    padding: '16px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    minWidth: '200px'
                }}>
                    <h4 style={{ margin: 0, color: '#f97316', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center', marginBottom: '8px' }}>
                        DEVs TOOLS
                    </h4>

                    <button
                        onClick={generateFakeData}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#ea580c',
                            color: 'white',
                            border: 'none',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600
                        }}
                    >
                        <RefreshCw size={16} />
                        Generar Data (1 Mes)
                    </button>

                    <button
                        onClick={clearAllData}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600
                        }}
                    >
                        <Trash2 size={16} />
                        Resetear Todo
                    </button>

                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: '5px' }}>
                        * Genera 280+ ventas y 20+ reportes
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '28px',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isOpen ? '#f97316' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                }}
            >
                <Database size={24} />
            </button>
        </div>
    );
};

export default DevTools;
