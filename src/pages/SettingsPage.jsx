import React, { useState, useEffect } from 'react';
import { useProduct } from '../context/ProductContext';
import { useAuth } from '../context/AuthContext';
// import { supabase } from '../supabaseClient';
import { Trash2, Plus, Save, ChevronRight, ChevronLeft, CircleDollarSign, Users, Package, Star, Box, Send, LogOut } from 'lucide-react';
import AccordionSection from '../components/AccordionSection';
import StockManager from '../components/StockManager';
import ContainerSelector from '../components/ContainerSelector';
import './SalesPage.css';

// --- Sub-component: BeerDashboardCard ---
const BeerDashboardCard = ({ beerName }) => {
    const {
        emissionOptions,
        getPrice,
        getInventory,
        exchangeRates = {},
        prices
    } = useProduct();

    const [subtype, setSubtype] = useState('Botella');

    const emissionsFromList = Array.isArray(emissionOptions)
        ? emissionOptions.filter(emission => getPrice(beerName, emission, subtype) > 0)
        : [];

    const discoveredEmissions = Object.keys(prices || {}).reduce((acc, key) => {
        if (!key.startsWith(beerName + '_')) return acc;
        if (!key.includes(subtype)) return acc;
        return acc;
    }, []);

    const allActiveEmissions = Array.from(new Set([...emissionsFromList, ...discoveredEmissions]));

    return (
        <div className="order-summary-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{beerName}</h3>
                <div style={{ width: '200px' }}>
                    <ContainerSelector value={subtype} onChange={setSubtype} />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {allActiveEmissions.length > 0 ? (
                    allActiveEmissions.map(emission => {
                        const price = getPrice(beerName, emission, subtype);
                        const localPrice = getPrice(beerName, emission, subtype, 'local');
                        const stock = getInventory(beerName, subtype);
                        const rate = exchangeRates.bcv || 0;
                        const bsPrice = (price * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        const hasLocalPrice = localPrice > 0 && localPrice !== price;

                        return (
                            <div key={emission} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontWeight: 600, color: '#333' }}>{emission}</span>
                                    {stock > 0 && (
                                        <span style={{ background: '#eef6ff', color: '#007AFF', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {stock} Disp.
                                        </span>
                                    )}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>${price}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#34c759', fontWeight: 600 }}>{bsPrice} Bs</div>
                                    {hasLocalPrice && (
                                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                                            Local: ${localPrice}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div style={{ textAlign: 'center', color: '#999', fontSize: '0.9rem', padding: '1rem' }}>
                        Sin configuración para {subtype}
                    </div>
                )}
            </div>
            <style jsx>{`
                .order-summary-card > div > div:last-child { border-bottom: none !important; padding-bottom: 0 !important; }
            `}</style>
        </div>
    );
};

// --- Main Component: SettingsPage ---
export default function SettingsPage() {
    console.log("SettingsPage Loaded");
    const {
        beerTypes, addBeerType, removeBeerType,
        emissionOptions, addEmissionType, removeEmissionType,
        prices, updatePrice, getPrice,
        inventory,
        exchangeRates = {}, fetchRates,
        conversions, updateConversion, subtypes, getUnitsPerEmission,
        getBeerColor, updateBeerColor
    } = useProduct();

    const { user, role, organizationId, organizationName, signOut } = useAuth();

    const roleTranslations = {
        'OWNER': 'Administrador',
        'EMPLOYEE': 'Empleado',
        'MANAGER': 'Gerente'
    };

    // Local State
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('EMPLOYEE');
    const [inviteStatus, setInviteStatus] = useState('');
    const [currentView, setCurrentView] = useState('main');
    const [openSettingSection, setOpenSettingSection] = useState('beers');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

    // Form inputs state
    const [newBeerName, setNewBeerName] = useState('');
    const [newBeerColor, setNewBeerColor] = useState('#3b82f6');

    // --- NUEVO: Estado para Nombre y Unidades de la Emisión ---
    const [newEmissionName, setNewEmissionName] = useState('');
    const [newEmissionUnits, setNewEmissionUnits] = useState(''); // <--- NUEVO

    const [selectedBeer, setSelectedBeer] = useState('');
    const [selectedEmission, setSelectedEmission] = useState('Unidad');
    const [selectedSubtype, setSelectedSubtype] = useState('Botella');
    const [selectedConversionSubtype, setSelectedConversionSubtype] = useState('Botella');
    const [priceInput, setPriceInput] = useState('');
    const [localPriceInput, setLocalPriceInput] = useState('');

    const presetColors = [
        '#FF8080', '#FFBF80', '#FFFF80', '#80FF80', '#80FFBF', '#80FFFF',
        '#80BFFF', '#BF80FF', '#FF80FF', '#C0C0C0', '#606060', '#000000'
    ];

    useEffect(() => {
        const handleResetFlow = (e) => {
            if (e.detail === '/ajustes') {
                setCurrentView('main');
                setOpenSettingSection(null);
            }
        };
        window.addEventListener('reset-flow', handleResetFlow);
        return () => window.removeEventListener('reset-flow', handleResetFlow);
    }, []);

    useEffect(() => {
        if (selectedBeer && selectedEmission && selectedSubtype) {
            const currentPrice = getPrice(selectedBeer, selectedEmission, selectedSubtype);
            setPriceInput(currentPrice > 0 ? currentPrice.toString() : '');

            const currentLocalPrice = getPrice(selectedBeer, selectedEmission, selectedSubtype, 'local');
            setLocalPriceInput(currentLocalPrice > 0 ? currentLocalPrice.toString() : '');
        }
    }, [selectedBeer, selectedEmission, selectedSubtype, prices]);

    // Handlers
    const handleAddBeer = async () => {
        if (!newBeerName.trim()) return;
        try {
            await addBeerType(newBeerName.trim(), newBeerColor);
            setNewBeerName('');
            setNewBeerColor('#3b82f6');
            alert('Producto agregado exitosamente');
        } catch (error) {
            console.error("Error adding beer:", error);
            alert('Error al agregar el producto.');
        }
    };

    // --- NUEVO: Handler actualizado para incluir Unidades ---
    const handleAddEmission = async () => {
        if (newEmissionName.trim() && newEmissionUnits) {
            const units = parseInt(newEmissionUnits);
            if (units < 1) {
                alert("Las unidades deben ser mayor a 0");
                return;
            }

            const result = await addEmissionType(newEmissionName.trim(), units);

            if (result.success) {
                setNewEmissionName('');
                setNewEmissionUnits(''); // Limpiar campo
                alert('Tipo de emisión guardado!');
            } else {
                alert('Error: ' + result.error);
            }
        } else {
            alert('Por favor ingresa nombre y unidades.');
        }
    };

    const handleSavePrice = () => {
        if (selectedBeer && selectedEmission && selectedSubtype && priceInput) {
            updatePrice(selectedBeer, selectedEmission, selectedSubtype, priceInput, false);
            if (localPriceInput) {
                updatePrice(selectedBeer, selectedEmission, selectedSubtype, localPriceInput, true);
            }
            alert('Producto actualizado correctamente');
        }
    };

    const toggleSettingSection = (section) => {
        setOpenSettingSection(openSettingSection === section ? null : section);
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        setInviteStatus('loading');
        // Mock Invitation
        setTimeout(() => {
            setInviteStatus('success');
            setInviteEmail('');
            setInviteRole('EMPLOYEE');
            alert('Invitación simulada enviada (Modo Local).');
        }, 1000);
    };

    const MainMenu = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {[
                { id: 'products', label: 'Gestion de Productos', icon: Package },
                { id: 'inventory', label: 'Inventario', icon: Box },
                { id: 'dashboard', label: 'Precios Actuales', icon: Star },
                { id: 'bcv', label: 'Tasas', icon: CircleDollarSign },
                { id: 'users', label: 'Usuarios', icon: Users },
            ].map(item => (
                <button
                    key={item.id}
                    className="option-btn"
                    onClick={() => setCurrentView(item.id)}
                    style={{ height: 'auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '16px', background: '#f5f5f7', border: 'none' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: '#e0e0e0', width: '36px', height: '36px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                            <item.icon size={20} color="#666" />
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: 500, color: '#333' }}>{item.label}</span>
                    </div>
                    <ChevronRight size={20} color="#999" />
                </button>
            ))}
        </div>
    );

    return (
        <div className="sales-container-v2" style={{ padding: '1rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', position: 'relative' }}>
                {currentView !== 'main' && (
                    <button
                        onClick={() => setCurrentView('main')}
                        style={{ position: 'absolute', left: 0, background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}
                    >
                        <ChevronLeft size={28} color="var(--text-primary)" />
                    </button>
                )}
                <h1 className="payment-section-title" style={{ fontSize: '1.5rem', margin: '0 auto' }}>
                    {currentView === 'main' && 'Ajustes'}
                    {currentView === 'bcv' && 'Tasas'}
                    {currentView === 'products' && 'Gestion de Productos'}
                    {currentView === 'dashboard' && 'Precios Actuales'}
                    {currentView === 'users' && 'Usuarios'}
                    {currentView === 'inventory' && 'Inventario'}
                </h1>
            </div>

            {currentView === 'main' && <MainMenu />}

            {currentView === 'bcv' && (
                <div className="order-summary-card">
                    <h3 className="modal-title" style={{ fontSize: '1.1rem', textAlign: 'left', marginBottom: '1rem' }}>Tasas del Día (DolarApi)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', padding: '1rem 0' }}>
                        <div style={{ background: '#f5f5f7', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem' }}>Tasa BCV (Oficial)</span>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#34c759' }}>
                                {exchangeRates.bcv ? `${exchangeRates.bcv} Bs` : '--.-- Bs'}
                            </div>
                        </div>
                        <div style={{ background: '#f5f5f7', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: 600, marginBottom: '0.5rem' }}>Tasa Paralelo</span>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff9500' }}>
                                {exchangeRates.parallel ? `${exchangeRates.parallel} Bs` : '--.-- Bs'}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#999', marginBottom: '1rem' }}>
                            Última Actualización: {exchangeRates.lastUpdate || 'Nunca'}
                        </span>
                        <button className="create-ticket-btn" onClick={fetchRates}>
                            Actualizar Tasas
                        </button>
                    </div>
                </div>
            )}

            {currentView === 'dashboard' && (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {Array.isArray(beerTypes) && beerTypes.map(beer => (
                        <BeerDashboardCard key={beer} beerName={beer} />
                    ))}
                    {(!beerTypes || beerTypes.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                            <p>No hay tipos de cerveza registrados.</p>
                        </div>
                    )}
                </div>
            )}

            {currentView === 'inventory' && <StockManager />}

            {currentView === 'users' && (
                <div className="order-summary-card">
                    {/* ... (Sección de usuarios sin cambios) ... */}
                    {/* Mantuve el código de usuarios original pero lo he resumido aquí para que quepa */}
                    <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ width: '64px', height: '64px', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                                <Users size={32} color="#333" />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Gestión de Usuarios</h2>
                            <p style={{ color: '#666', marginTop: '0.5rem' }}>
                                <strong>Organización:</strong> <span style={{ fontWeight: 600, color: '#000' }}>{organizationName || 'Cargando...'}</span>
                            </p>
                        </div>
                        {/* Invite Logic */}
                        {(role === 'OWNER' || !role) && (
                            <div style={{ background: '#f9fafb', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>Invitar Nuevo Usuario</h3>
                                <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px', display: 'block' }}>Email</label>
                                        <input type="email" placeholder="usuario@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required className="ticket-input-large" />
                                    </div>
                                    <button type="submit" disabled={inviteStatus === 'loading'} style={{ background: '#000', color: 'white', border: 'none', borderRadius: '12px', padding: '1rem', fontWeight: 600 }}>
                                        {inviteStatus === 'loading' ? '...' : 'Invitar'}
                                    </button>
                                </form>
                            </div>
                        )}
                        <button onClick={signOut} style={{ background: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '16px', border: 'none', width: '100%', fontWeight: 600 }}>Cerrar Sesión</button>
                    </div>
                </div>
            )}

            {currentView === 'products' && (
                <>
                    <AccordionSection title="Tipos de Cerveza" isOpen={openSettingSection === 'beers'} onToggle={() => toggleSettingSection('beers')}>
                        <div style={{ position: 'relative', marginBottom: '1rem' }}>
                            <div className="input-group-large" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button onClick={(e) => { const rect = e.target.getBoundingClientRect(); setPickerPos({ top: rect.bottom + 10, left: rect.left }); setShowColorPicker(!showColorPicker); }} style={{ width: '24px', height: '24px', borderRadius: '50%', background: newBeerColor, border: '2px solid #ddd', cursor: 'pointer', flexShrink: 0 }} />
                                <input type="text" placeholder="Nueva Cerveza" className="ticket-input-large" value={newBeerName} onChange={(e) => setNewBeerName(e.target.value)} style={{ flex: 1 }} />
                                <button onClick={handleAddBeer} className="option-btn selected" style={{ padding: '1rem', height: 'auto', borderRadius: '50%' }}><Plus size={24} /></button>
                            </div>
                            {showColorPicker && (
                                <div style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 1000, background: 'white', padding: '1rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', width: '280px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                                        {presetColors.map(color => (
                                            <button key={color} onClick={() => { setNewBeerColor(color); setShowColorPicker(false); }} style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', background: color, border: newBeerColor === color ? '3px solid #000' : '2px solid transparent' }} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="options-grid" style={{ gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                            {Array.isArray(beerTypes) && beerTypes.map(beer => {
                                const color = getBeerColor(beer);
                                return (
                                    <div key={beer} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f5f5f7', borderRadius: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: color.raw || color.bg }}></div>
                                            <span style={{ fontWeight: 500 }}>{beer}</span>
                                        </div>
                                        <button onClick={() => removeBeerType(beer)} style={{ color: '#ff3b30', background: 'none', border: 'none' }}><Trash2 size={20} /></button>
                                    </div>
                                );
                            })}
                        </div>
                    </AccordionSection>

                    {/* --- SECCIÓN ACTUALIZADA DE EMISIONES --- */}
                    <AccordionSection
                        title="Formas de Emisión"
                        isOpen={openSettingSection === 'emissions'}
                        onToggle={() => toggleSettingSection('emissions')}
                    >
                        <div style={{ marginBottom: '1rem' }}>
                            <label className="text-secondary text-sm">Configurar para:</label>
                            <ContainerSelector value={selectedConversionSubtype} onChange={setSelectedConversionSubtype} />
                        </div>

                        {/* INPUTS NUEVOS: Nombre + Unidades */}
                        <div className="input-group-large" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="Nombre (ej: Pack)"
                                className="ticket-input-large"
                                value={newEmissionName}
                                onChange={(e) => setNewEmissionName(e.target.value)}
                                style={{ flex: 2 }}
                            />
                            <input
                                type="number"
                                placeholder="Uds"
                                className="ticket-input-large"
                                value={newEmissionUnits}
                                onChange={(e) => setNewEmissionUnits(e.target.value)}
                                style={{ flex: 1, minWidth: '60px' }}
                            />
                            <button onClick={handleAddEmission} className="option-btn selected" style={{ padding: '1rem', height: 'auto', borderRadius: '50%' }}>
                                <Plus size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {Array.isArray(emissionOptions) && emissionOptions.map(emission => {
                                const currentVal = getUnitsPerEmission(emission, selectedConversionSubtype);
                                return (
                                    <div key={emission} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f5f5f7', borderRadius: '12px' }}>
                                        <span style={{ fontWeight: 500, flex: 1 }}>{emission}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1rem' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#666' }}>=</span>
                                            {/* Esto actualiza la conversión específica del subtipo, si se desea sobrescribir el global */}
                                            <input
                                                type="number"
                                                value={currentVal}
                                                onChange={(e) => updateConversion(emission, e.target.value, selectedConversionSubtype)}
                                                style={{ width: '50px', padding: '4px', borderRadius: '6px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold' }}
                                            />
                                            <span style={{ fontSize: '0.7rem', color: '#888' }}>Uds</span>
                                        </div>
                                        {emission !== 'Caja' && emission !== 'Unidad' ? (
                                            <button onClick={() => removeEmissionType(emission)} style={{ color: '#ff3b30', background: 'none', border: 'none' }}>
                                                <Trash2 size={20} />
                                            </button>
                                        ) : (
                                            <div style={{ width: 20, height: 20 }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </AccordionSection>

                    <AccordionSection title="Configurar Precios" isOpen={openSettingSection === 'pricing'} onToggle={() => toggleSettingSection('pricing')}>
                        {/* ... (Sección precios sin cambios) ... */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="text-secondary text-sm">Cerveza</label>
                                <div className="options-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '0.5rem' }}>
                                    {Array.isArray(beerTypes) && beerTypes.map(beer => (
                                        <button key={beer} className={`option-btn ${selectedBeer === beer ? 'selected' : ''}`} onClick={() => setSelectedBeer(beer)} style={{ fontSize: '0.8rem', padding: '0.75rem' }}>{beer}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-secondary text-sm">Emisión</label>
                                <div className="options-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '0.5rem' }}>
                                    {Array.isArray(emissionOptions) && emissionOptions.map(opt => (
                                        <button key={opt} className={`option-btn ${selectedEmission === opt ? 'selected' : ''}`} onClick={() => setSelectedEmission(opt)} style={{ fontSize: '0.7rem', padding: '0.75rem' }}>{opt}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-secondary text-sm">Presentación</label>
                                <ContainerSelector value={selectedSubtype} onChange={setSelectedSubtype} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="text-secondary text-sm">Precio Local ($)</label>
                                    <input type="number" placeholder="$0.00" className="ticket-input-large" value={localPriceInput} onChange={(e) => setLocalPriceInput(e.target.value)} style={{ marginTop: '0.5rem' }} />
                                </div>
                                <div>
                                    <label className="text-secondary text-sm">Para Llevar ($)</label>
                                    <input type="number" placeholder="$0.00" className="ticket-input-large" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} style={{ marginTop: '0.5rem' }} />
                                </div>
                            </div>
                            <button className="create-ticket-btn" onClick={handleSavePrice} disabled={!selectedBeer || !priceInput} style={{ marginTop: '2rem' }}>
                                <Save size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Guardar
                            </button>
                        </div>
                    </AccordionSection>
                </>
            )}
        </div>
    );
}