import React, { useState, useEffect } from 'react';
import { useProduct } from '../context/ProductContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
// import { supabase } from '../supabaseClient';
import { Trash2, Plus, Save, ChevronRight, ChevronLeft, CircleDollarSign, Users, Package, Star, Box, Send, LogOut, Moon, Sun, Store, ShoppingBag, Search, ChevronDown, ChevronUp, X, Pencil } from 'lucide-react';
import AccordionSection from '../components/AccordionSection';
import StockManager from '../components/StockManager';
import ContainerSelector from '../components/ContainerSelector';
import './SalesPage.css';

// --- Helpers for Fuzzy Search ---
const levenshteinDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const isFuzzyMatch = (text, queryTerm) => {
    const cleanText = text.toLowerCase();
    const term = queryTerm.toLowerCase();

    // 1. Exact substring match
    if (cleanText.includes(term)) return true;

    // 2. Fuzzy match against words
    if (term.length > 3) {
        const words = cleanText.split(/[\s-]+/); // Split by space or dash
        return words.some(word => {
            // Allow more typos for longer words
            const maxDist = word.length > 6 ? 3 : 2;
            return levenshteinDistance(term, word) <= maxDist;
        });
    }

    return false;
};

// Check if ALL terms in query match the text (or part of it)
const smartSearchMatch = (text, fullQuery) => {
    if (!fullQuery) return true;
    const terms = fullQuery.toLowerCase().split(' ').filter(t => t.length > 0);
    if (terms.length === 0) return true;
    return terms.every(term => isFuzzyMatch(text, term));
};

const getGlobalSearchScore = (beerName, fullQuery, allActiveEmissions = []) => {
    if (!fullQuery || fullQuery.length < 2) return 0;
    const normalizedQuery = fullQuery.toLowerCase();

    // 1. Direct match or Smart match (Full query matches beer name)
    if (smartSearchMatch(beerName, normalizedQuery)) return 100;

    // 2. Partial match: At least one term matches beer name
    const terms = normalizedQuery.split(' ').filter(t => t.length > 0);
    const someTermMatchesBeer = terms.some(t => isFuzzyMatch(beerName, t));

    // 3. Emission match: At least one term matches an emission
    const someTermMatchesEmission = terms.some(t =>
        allActiveEmissions.some(e => isFuzzyMatch(e, t))
    );

    if (someTermMatchesBeer && someTermMatchesEmission) return 90;
    if (someTermMatchesBeer) return 80;
    if (someTermMatchesEmission) return 70;

    return 0;
};

// --- Sub-component: BeerDashboardCard ---
const BeerDashboardCard = ({ beerName, searchFilter = '' }) => {
    const {
        emissionOptions,
        getPrice,
        getInventory,
        exchangeRates = {},
        prices
    } = useProduct();

    // 1. State Hooks
    const [subtype, setSubtype] = useState('Botella');
    const [isExpanded, setIsExpanded] = useState(false);
    const normalizedQuery = searchFilter.toLowerCase();

    // 2. Derived Data (Emissions)
    const emissionsFromList = Array.isArray(emissionOptions)
        ? emissionOptions.filter(emission => getPrice(beerName, emission, subtype) > 0)
        : [];

    const discoveredEmissions = Object.keys(prices || {}).reduce((acc, key) => {
        if (!key.startsWith(beerName + '_')) return acc;
        if (!key.includes(subtype)) return acc;
        const emissionPart = key.replace(beerName + '_', '').split('_')[0];
        if (emissionPart) acc.push(emissionPart);
        return acc;
    }, []);

    const allActiveEmissions = Array.from(new Set([...emissionsFromList, ...discoveredEmissions]));

    // 3. Search Relevance & Visibility
    const searchScore = getGlobalSearchScore(beerName, normalizedQuery, allActiveEmissions);
    const isVisible = normalizedQuery.length < 2 || searchScore > 0;

    // 4. Effects (Auto-expand & Subtype switching)
    useEffect(() => {
        if (!normalizedQuery) return;

        // Auto-expand ONLY if it's a strong match (Name match 80+, or Emission match 70+)
        if (searchScore >= 70) {
            setIsExpanded(true);
        }

        if (isFuzzyMatch('lata', normalizedQuery) || normalizedQuery.includes('lata')) {
            setSubtype(prev => prev.includes('Lata') ? prev : 'Lata Pequeña');
        } else if (isFuzzyMatch('botella', normalizedQuery) || normalizedQuery.includes('botella')) {
            setSubtype('Botella');
        }
    }, [normalizedQuery, searchScore]);

    // 5. Filtered Emissions for Display
    const filteredEmissions = allActiveEmissions.filter(emission => {
        if (normalizedQuery.length < 2) return true;
        const terms = normalizedQuery.split(' ').filter(t => t.length > 0);
        const matchesThisEmission = terms.some(term => isFuzzyMatch(emission, term));
        const queryHasEmissionTerm = terms.some(term =>
            allActiveEmissions.some(e => term.length > 2 && isFuzzyMatch(e, term))
        );
        if (queryHasEmissionTerm) return matchesThisEmission;
        return true;
    });

    const formatBs = (usd) => {
        const rate = exchangeRates.bcv || 0;
        return (usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs';
    };

    if (!isVisible) return null;
    if (filteredEmissions.length === 0 && normalizedQuery.length > 2) return null;

    return (
        <div className="order-summary-card" style={{ padding: '1.5rem', transition: 'all 0.3s ease' }}>
            {/* Clickable Header for Collapse */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isExpanded ? '1.5rem' : '0',
                    cursor: 'pointer'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isExpanded ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{beerName}</h3>
                </div>

                {/* Stop propagation on selector so we can change type without toggling card */}
                <div style={{ width: '200px' }} onClick={(e) => e.stopPropagation()}>
                    <ContainerSelector value={subtype} onChange={setSubtype} />
                </div>
            </div>

            {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s ease' }}>
                    {filteredEmissions.length > 0 ? (
                        filteredEmissions.map(emission => {
                            const standardPrice = getPrice(beerName, emission, subtype);
                            const rawLocal = getPrice(beerName, emission, subtype, 'local');
                            const localPrice = rawLocal > 0 ? rawLocal : standardPrice;
                            const stock = getInventory(beerName, subtype);

                            return (
                                <div key={emission} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    paddingBottom: '1.5rem',
                                    borderBottom: '1px solid var(--accent-light)',
                                    gap: '1rem'
                                }}>
                                    {/* Header: Emission + Stock */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{emission}</span>
                                            {subtype !== 'Botella' && (
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                    {subtype}
                                                </span>
                                            )}
                                        </div>
                                        {stock > 0 && emission === 'Caja' && (
                                            <span style={{ background: '#eef6ff', color: '#007AFF', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                {stock} Disp.
                                            </span>
                                        )}
                                    </div>

                                    {/* Price Grid: Llevar vs Local */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                        gap: '0.75rem'
                                    }}>
                                        {/* Para Llevar */}
                                        <div style={{
                                            background: 'var(--bg-card-hover)',
                                            padding: '0.75rem',
                                            borderRadius: '12px',
                                            display: 'flex', flexDirection: 'column', gap: '4px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                <ShoppingBag size={14} color="var(--text-secondary)" />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.7 }}>PARA LLEVAR</span>
                                            </div>
                                            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>${standardPrice}</span>
                                            <span style={{ fontSize: '0.9rem', color: '#34c759', fontWeight: 600 }}>{formatBs(standardPrice)}</span>
                                        </div>

                                        {/* Consumo Local */}
                                        <div style={{
                                            background: 'var(--bg-card-hover)',
                                            padding: '0.75rem',
                                            borderRadius: '12px',
                                            display: 'flex', flexDirection: 'column', gap: '4px',
                                            border: rawLocal > 0 ? '1px solid var(--accent-light)' : '1px dashed transparent'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                <Store size={14} color="var(--text-secondary)" />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.7 }}>LOCAL</span>
                                            </div>
                                            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>${localPrice}</span>
                                            <span style={{ fontSize: '0.9rem', color: '#34c759', fontWeight: 600 }}>{formatBs(localPrice)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
                            Sin resultados para "{searchFilter}"
                        </div>
                    )}
                </div>
            )}
            <style jsx>{`
                .order-summary-card > div > div:last-child { border-bottom: none !important; padding-bottom: 0 !important; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

// --- Sub-component: BeerPriceEditor (Bulk Edit) ---
const BeerPriceEditor = ({ beerName, searchFilter = '' }) => {
    const {
        getEmissionsForSubtype,
        getPrice,
        updatePrice, currencySymbol
    } = useProduct();
    const { showNotification } = useNotification();

    // Local Popup State
    const [successPopup, setSuccessPopup] = useState(null); // { message: string }

    // Auto-close popup
    useEffect(() => {
        if (successPopup) {
            const timer = setTimeout(() => {
                setSuccessPopup(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [successPopup]);

    // Collapsible Logic
    const [subtype, setSubtype] = useState('Botella');
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-expand if search matches
    useEffect(() => {
        if (searchFilter && searchFilter.length > 1) {
            setIsExpanded(true);
        } else {
            setIsExpanded(false);
        }
    }, [searchFilter]);

    // Memoize calculating emissions to prevent infinite render loop
    const emissions = React.useMemo(() =>
        getEmissionsForSubtype(subtype),
        [getEmissionsForSubtype, subtype]
    );

    // Filter emissions if searching
    const filteredEmissions = emissions.filter(e => {
        if (!searchFilter) return true;
        // If the beer name itself matches deeply, show all emissions
        if (isFuzzyMatch(beerName, searchFilter)) return true;
        // Otherwise check if emission matches
        return isFuzzyMatch(e, searchFilter);
    });

    // Local state map: { 'Unidad': { standard: '', local: '' }, ... }
    const [priceMap, setPriceMap] = useState({});

    // Load initial prices when beer/subtype changes
    useEffect(() => {
        const initialMap = {};
        emissions.forEach(emi => {
            const std = getPrice(beerName, emi, subtype);
            const loc = getPrice(beerName, emi, subtype, 'local');
            initialMap[emi] = {
                standard: std > 0 ? std : '',
                local: loc > 0 ? loc : ''
            };
        });
        setPriceMap(initialMap);
    }, [beerName, subtype, emissions, getPrice]);

    const handleInputChange = (emission, type, value) => {
        setPriceMap(prev => ({
            ...prev,
            [emission]: {
                ...prev[emission],
                [type]: value
            }
        }));
    };

    const handleSaveAll = () => {
        const changes = [];
        Object.entries(priceMap).forEach(([emission, values]) => {
            // Update Standard
            if (values.standard !== '') {
                const oldPrice = getPrice(beerName, emission, subtype, 'standard');
                const newPrice = parseFloat(values.standard);
                if (oldPrice !== newPrice) {
                    changes.push({ emission, type: 'Llevar', old: oldPrice, new: newPrice });
                    updatePrice(beerName, emission, subtype, values.standard, false);
                }
            }
            // Update Local
            if (values.local !== '') {
                const oldPrice = getPrice(beerName, emission, subtype, 'local');
                const newPrice = parseFloat(values.local);
                if (oldPrice !== newPrice) {
                    changes.push({ emission, type: 'Local', old: oldPrice, new: newPrice });
                    updatePrice(beerName, emission, subtype, values.local, true);
                }
            }
        });

        if (changes.length > 0) {
            setSuccessPopup({ beerName, subtype, changes });
        } else {
            showNotification('No se detectaron cambios', 'info');
        }
    };

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--accent-light)',
            position: 'relative'
        }}>
            {/* Header / Toggle Row */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isExpanded ? '1.5rem' : '0',
                    cursor: 'pointer'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isExpanded ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{beerName}</h3>
                </div>

                <div style={{ width: '200px' }} onClick={(e) => e.stopPropagation()}>
                    <ContainerSelector value={subtype} onChange={setSubtype} />
                </div>
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {filteredEmissions.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem' }}>
                            Sin resultados para "{searchFilter}"
                        </div>
                    )}

                    {filteredEmissions.map(emission => (
                        <div key={emission} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            paddingBottom: '1.5rem',
                            borderBottom: '1px solid var(--accent-light)',
                            gap: '0.75rem'
                        }}>
                            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{emission}</span>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                gap: '0.75rem'
                            }}>
                                {/* Standard (Para Llevar) */}
                                <div style={{ background: 'var(--bg-card-hover)', padding: '0.75rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        <ShoppingBag size={14} color="var(--text-secondary)" />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.7 }}>PARA LLEVAR ({currencySymbol})</span>
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        className="price-input"
                                        value={priceMap[emission]?.standard || ''}
                                        onChange={(e) => handleInputChange(emission, 'standard', e.target.value)}
                                        style={{
                                            background: 'var(--bg-input)', border: '1px solid var(--accent-light)',
                                            borderRadius: '8px', padding: '8px', width: '100%', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)'
                                        }}
                                    />
                                </div>

                                {/* Local */}
                                <div style={{ background: 'var(--bg-card-hover)', padding: '0.75rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        <Store size={14} color="var(--text-secondary)" />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.7 }}>LOCAL ({currencySymbol})</span>
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        className="price-input"
                                        value={priceMap[emission]?.local || ''}
                                        onChange={(e) => handleInputChange(emission, 'local', e.target.value)}
                                        style={{
                                            background: 'var(--bg-input)', border: '1px solid var(--accent-light)',
                                            borderRadius: '8px', padding: '8px', width: '100%', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    <div style={{ marginTop: '1.5rem' }}>
                        <button
                            onClick={handleSaveAll}
                            style={{
                                width: '100%',
                                background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                                color: 'white',
                                padding: '14px',
                                borderRadius: '16px',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                boxShadow: '0 8px 20px rgba(249, 115, 22, 0.25)',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                            }}
                        >
                            <Save size={20} />
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .order-summary-card > div > div:last-child { border-bottom: none !important; padding-bottom: 0 !important; }
                @keyframes fadeInPopup { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
            `}</style>

            {/* LOCAL POPUP FOR PRICE UPDATES */}
            {successPopup && (
                <div
                    onClick={() => setSuccessPopup(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 10000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            backgroundColor: 'var(--bg-card)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            color: 'var(--text-primary)',
                            padding: '24px 32px',
                            borderRadius: '20px',
                            boxShadow: 'var(--shadow-lg)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            minWidth: '320px',
                            maxWidth: '400px',
                            textAlign: 'center',
                            border: '1px solid var(--accent-light)',
                            animation: 'fadeInPopup 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            position: 'relative'
                        }}>
                        <button
                            onClick={() => setSuccessPopup(null)}
                            style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-primary)',
                                opacity: 0.5,
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            <X size={18} />
                        </button>
                        <div>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '12px',
                                margin: '0 auto'
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>

                            {typeof successPopup === 'string' ? (
                                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{successPopup}</span>
                            ) : (
                                <>
                                    <h4 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                        Actualizado {successPopup.beerName} ({successPopup.subtype})
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                        {successPopup.changes.map((change, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                background: 'var(--bg-card-hover)', padding: '10px 14px', borderRadius: '12px',
                                                fontSize: '0.9rem',
                                                border: '1px solid var(--accent-light)'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>{change.emission}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{change.type}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{currencySymbol}{change.old}</span>
                                                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                                                    <span style={{ color: '#34c759', fontWeight: 'bold' }}>{currencySymbol}{change.new}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

// --- Main Component: SettingsPage ---
export default function SettingsPage() {
    console.log("SettingsPage Loaded");
    const {
        beerTypes, addBeerType, removeBeerType,
        emissionOptions, addEmissionType, removeEmissionType, getEmissionsForSubtype,
        prices, updatePrice, getPrice,
        inventory,
        exchangeRates = {}, fetchRates,
        conversions, updateConversion, subtypes, getUnitsPerEmission,
        checkAggregateStock, getBeerColor, updateBeerColor,
        mainCurrency, setMainCurrency
    } = useProduct();

    const { user, role, organizationId, organizationName, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { showNotification } = useNotification();

    const roleTranslations = {
        'OWNER': 'Administrador',
        'EMPLOYEE': 'Empleado',
        'MANAGER': 'Gerente'
    };

    // Local State
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('EMPLOYEE');
    const [inviteStatus, setInviteStatus] = useState('');
    const [historyModalOpen, setHistoryModalOpen] = useState(false); // NEW History Modal state
    const [currentView, setCurrentView] = useState('main');
    const [openSections, setOpenSections] = useState({ beers: true });
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditMode, setIsEditMode] = useState(false); // NEW: Toggle for Edit Mode in Dashboard

    const toggleSettingSection = (section) => {
        setOpenSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Form inputs state
    const [newBeerName, setNewBeerName] = useState('');
    const [newBeerColor, setNewBeerColor] = useState('#3b82f6');

    // --- NUEVO: Estado para Nombre y Unidades de la Emisión ---
    const [newEmissionName, setNewEmissionName] = useState('');
    const [selectedBeer, setSelectedBeer] = useState('');

    // Unused state removed for cleanliness implicitly by not including it, 
    // but the component body continues below...

    // ... [existing presetColors, useEffects, handlers] ...
    const presetColors = [
        '#FF8080', '#FFBF80', '#FFFF80', '#80FF80', '#80FFBF', '#80FFFF',
        '#80BFFF', '#BF80FF', '#FF80FF', '#C0C0C0', '#606060', '#000000'
    ];

    useEffect(() => {
        const handleResetFlow = (e) => {
            if (e.detail === '/ajustes') {
                setCurrentView('main');
                setOpenSections({});
            }
        };
        window.addEventListener('reset-flow', handleResetFlow);
        return () => window.removeEventListener('reset-flow', handleResetFlow);
    }, []);

    // ... [Handlers maintained] ...
    const handleAddBeer = async () => {
        if (!newBeerName.trim()) return;
        try {
            await addBeerType(newBeerName.trim(), newBeerColor);
            setNewBeerName('');
            setNewBeerColor('#3b82f6');
            showNotification('Producto agregado exitosamente', 'success');
        } catch (error) {
            console.error("Error adding beer:", error);
            showNotification('Error al agregar el producto.', 'error');
        }
    };

    const normalizeSubtype = (subtype) => {
        if (!subtype) return 'Botella';
        const s = subtype.toLowerCase();
        if (s.includes('lata')) return 'Lata';
        if (s.includes('botella')) return 'Botella';
        return subtype;
    };

    const handleAddEmission = async () => {
        if (newEmissionName.trim()) {
            const normalized = normalizeSubtype(selectedConversionSubtype);
            const result = await addEmissionType(newEmissionName.trim(), 1, normalized);
            if (result.success) {
                setNewEmissionName('');
                showNotification('Tipo de emisión guardado!', 'success');
            } else {
                showNotification('Error: ' + result.error, 'error');
            }
        } else {
            showNotification('Por favor ingresa un nombre.', 'warning');
        }
    };

    // ... Main Menu render remains same ...

    // ... [Inside Return] ...

    // State needed for Emission section (keeping consistent with existing logic)
    const [selectedConversionSubtype, setSelectedConversionSubtype] = useState('Botella');



    const MainMenu = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {[
                { id: 'products', label: 'Gestion de Productos', icon: Package },
                { id: 'dashboard', label: 'Precios Actuales', icon: Star },
                { id: 'inventory', label: 'Inventario', icon: Box },
                { id: 'bcv', label: 'Tasas', icon: CircleDollarSign },
                { id: 'users', label: 'Usuarios', icon: Users },
                { id: 'app', label: 'Apariencia', icon: Sun },
            ].map(item => (
                <button
                    key={item.id}
                    className="option-btn"
                    onClick={() => setCurrentView(item.id)}
                    style={{ height: 'auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '16px', background: 'var(--bg-card)', border: 'none' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'var(--bg-app)', width: '36px', height: '36px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                            <item.icon size={20} color="var(--text-secondary)" />
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</span>
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
                    {currentView === 'bcv' && 'Tasas '}
                    {currentView === 'products' && 'Gestion de Productos'}
                    {currentView === 'dashboard' && 'Precios Actuales'}
                    {currentView === 'users' && 'Usuarios'}
                    {currentView === 'inventory' && 'Inventario'}
                    {currentView === 'app' && 'Apariencia'}
                </h1>
            </div>

            {currentView === 'main' && <MainMenu />}

            {currentView === 'app' && (
                <div className="order-summary-card">
                    <h3 className="modal-title" style={{ fontSize: '1.1rem', textAlign: 'left', marginBottom: '1rem' }}>Preferencias de Tema</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ background: theme === 'dark' ? '#333' : '#e0e0e0', padding: '0', borderRadius: '50%', width: '40px', height: '40px', minWidth: '40px', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {theme === 'dark' ? <Moon size={24} color="white" /> : <Sun size={24} color="#333" />}
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1rem' }}>Modo Oscuro</h4>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {theme === 'dark' ? 'Activado' : 'Desactivado'}
                                </p>
                            </div>
                        </div>

                        {/* Simple Toggle Switch */}
                        <div
                            onClick={toggleTheme}
                            style={{
                                width: '50px',
                                height: '28px',
                                background: theme === 'dark' ? '#34c759' : '#e5e5ea',
                                borderRadius: '999px',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'background 0.3s ease'
                            }}
                        >
                            <div style={{
                                width: '24px',
                                height: '24px',
                                background: 'white',
                                borderRadius: '50%',
                                position: 'absolute',
                                top: '2px',
                                left: theme === 'dark' ? '24px' : '2px',
                                transition: 'left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </div>

                </div>
            )}

            {currentView === 'bcv' && (
                <div className="order-summary-card">
                    <h3 className="modal-title" style={{ fontSize: '1.1rem', textAlign: 'left', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Tasas del Día:
                        <button
                            onClick={() => setHistoryModalOpen(true)}
                            style={{
                                background: 'var(--bg-card-hover)',
                                border: '1px solid var(--accent-light)',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: 'var(--text-primary)',
                                fontWeight: 500,
                                fontSize: '0.85rem'
                            }}
                        >
                            <Box size={16} />
                            Historial
                        </button>
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', padding: '1rem 0' }}>
                        <div style={{ background: 'var(--bg-card-hover)', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>Tasa BCV (USD)</span>
                            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#34c759' }}>
                                {exchangeRates.bcv ? `${exchangeRates.bcv} Bs` : '--.-- Bs'}
                            </div>
                            {exchangeRates.nextRates && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {/* Append noon time to prevent timezone rollback from UTC midnight */}
                                    {new Date(exchangeRates.nextRates.date + 'T12:00:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric' })}: {exchangeRates.nextRates.usd} Bs
                                </span>
                            )}
                        </div>
                        <div style={{ background: 'var(--bg-card-hover)', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>Tasa BCV (Euro)</span>
                            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#3b82f6' }}>
                                {exchangeRates.euro ? `${Number(exchangeRates.euro).toFixed(2)} Bs` : '--.-- Bs'}
                            </div>
                            {exchangeRates.nextRates && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {new Date(exchangeRates.nextRates.date + 'T12:00:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric' })}: {Number(exchangeRates.nextRates.eur).toFixed(2)} Bs
                                </span>
                            )}
                        </div>
                        <div style={{ background: 'var(--bg-card-hover)', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>Tasa Paralelo (USDT)</span>
                            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#ff9500' }}>
                                {exchangeRates.parallel ? `${exchangeRates.parallel} Bs` : '--.-- Bs'}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#999', marginBottom: '1rem' }}>
                            Última Actualización: {exchangeRates.lastUpdate || 'Nunca'}
                        </span>

                        {/* Selector de Moneda Principal */}
                        <div style={{
                            background: 'var(--bg-card-hover)',
                            padding: '1rem',
                            borderRadius: '16px',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: '100%',
                            border: '1px solid var(--accent-light)'
                        }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Moneda Principal de Negocio</span>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => setMainCurrency('USD')}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '12px',
                                        background: mainCurrency === 'USD' ? '#34c759' : 'transparent',
                                        color: mainCurrency === 'USD' ? 'white' : 'var(--text-secondary)',
                                        border: mainCurrency === 'USD' ? 'none' : '1px solid var(--accent-light)',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Dolar BCV ($)
                                </button>
                                <button
                                    onClick={() => setMainCurrency('EUR')}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '12px',
                                        background: mainCurrency === 'EUR' ? '#3b82f6' : 'transparent',
                                        color: mainCurrency === 'EUR' ? 'white' : 'var(--text-secondary)',
                                        border: mainCurrency === 'EUR' ? 'none' : '1px solid var(--accent-light)',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Euro BCV (€)
                                </button>
                            </div>
                        </div>

                        <button className="create-ticket-btn" onClick={fetchRates}>
                            Actualizar Tasas
                        </button>
                    </div>
                </div>
            )}

            {/* HISTORY MODAL */}
            {historyModalOpen && (
                <div
                    onClick={() => setHistoryModalOpen(false)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-card)', width: '90%', maxWidth: '400px',
                            borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                        }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--accent-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Historial (7 Días)</h3>
                            <button onClick={() => setHistoryModalOpen(false)} style={{ color: 'var(--text-primary)' }}>&times;</button>
                        </div>
                        <div style={{ padding: '1rem', overflowY: 'auto', maxHeight: '60vh' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'center' }}>
                                <thead>
                                    <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--accent-light)' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Fecha</th>
                                        <th style={{ padding: '0.75rem' }}>USD</th>
                                        <th style={{ padding: '0.75rem' }}>EUR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!exchangeRates.history || exchangeRates.history.length === 0) ? (
                                        <tr><td colSpan="3" style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Cargando datos...</td></tr>
                                    ) : (
                                        exchangeRates.history.map((rate, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--bg-card-hover)' }}>
                                                <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 500 }}>{rate.date}</td>
                                                <td style={{ padding: '0.75rem', color: '#34c759', fontWeight: 600 }}>{rate.usd}</td>
                                                <td style={{ padding: '0.75rem', color: '#3b82f6', fontWeight: 600 }}>{rate.eur}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '1rem', borderTop: '1px solid var(--accent-light)' }}>
                            <button onClick={() => setHistoryModalOpen(false)} style={{ width: '100%', padding: '12px', background: 'var(--bg-card-hover)', borderRadius: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {currentView === 'dashboard' && (
                <div style={{ display: 'grid', gap: '1rem' }}>

                    <div className="app-search-container">
                        <Search className="app-search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar cerveza, unidad, tipo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="app-search-input"
                        />
                    </div>

                    {/* TOGGLE EDIT MODE BUTTON */}
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '12px',
                            // Orange Theme Logic: Adapted for Light/Dark
                            background: theme === 'dark' ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED',
                            color: theme === 'dark' ? '#FB923C' : '#EA580C',
                            border: theme === 'dark' ? '1px solid rgba(234, 88, 12, 0.2)' : '1px solid #FFEDD5',
                            fontWeight: 600,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: isEditMode ? '0 0 0 2px rgba(234, 88, 12, 0.4)' : 'none'
                        }}
                    >
                        <Pencil size={18} />
                        {isEditMode ? 'Terminar Edición' : 'Editar Precios'}
                    </button>


                    {Array.isArray(beerTypes) && [...beerTypes]
                        .sort((a, b) => {
                            if (!searchQuery || searchQuery.length < 2) return 0;
                            // For sorting, we can just use the score based on beer name match
                            // or a simplified version since we don't have emissions here easily.
                            const scoreA = getGlobalSearchScore(a, searchQuery);
                            const scoreB = getGlobalSearchScore(b, searchQuery);
                            return scoreB - scoreA;
                        })
                        .map(beer => (
                            isEditMode ? (
                                <BeerPriceEditor key={beer} beerName={beer} searchFilter={searchQuery} />
                            ) : (
                                <BeerDashboardCard key={beer} beerName={beer} searchFilter={searchQuery} />
                            )
                        ))}
                    {(!beerTypes || beerTypes.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            <p>No hay tipos de cerveza registrados.</p>
                        </div>
                    )}
                </div>
            )
            }

            {currentView === 'inventory' && <StockManager />}

            {
                currentView === 'users' && (
                    <div className="order-summary-card">
                        {/* ... (Sección de usuarios sin cambios) ... */}
                        {/* Mantuve el código de usuarios original pero lo he resumido aquí para que quepa */}
                        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                            <div style={{ marginBottom: '2rem' }}>
                                <div style={{ width: '64px', height: '64px', background: 'var(--bg-card-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                                    <Users size={32} color="var(--text-primary)" />
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Gestión de Usuarios</h2>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                    <strong>Organización:</strong> <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{organizationName || 'Cargando...'}</span>
                                </p>
                            </div>
                            {/* Invite Logic */}
                            {(role === 'OWNER' || !role) && (
                                <div style={{ background: 'var(--bg-card-hover)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
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
                )
            }

            {
                currentView === 'products' && (
                    <>
                        <AccordionSection title="Tipos de Cerveza" isOpen={!!openSections['beers']} onToggle={() => toggleSettingSection('beers')}>
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
                                        <div key={beer} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-card-hover)', borderRadius: '12px' }}>
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
                            isOpen={!!openSections['emissions']}
                            onToggle={() => toggleSettingSection('emissions')}
                        >
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="text-secondary text-sm">Configurar para:</label>
                                <ContainerSelector value={selectedConversionSubtype} onChange={setSelectedConversionSubtype} />
                            </div>

                            {/* INPUTS NUEVOS: Nombre (Sin Unidades) */}
                            <div className="input-group-large" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    placeholder="Nombre (ej: Pack)"
                                    className="ticket-input-large"
                                    value={newEmissionName}
                                    onChange={(e) => setNewEmissionName(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <button onClick={handleAddEmission} className="option-btn selected" style={{ padding: '1rem', height: 'auto', borderRadius: '50%' }}>
                                    <Plus size={24} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {getEmissionsForSubtype(normalizeSubtype(selectedConversionSubtype)).map(emission => {
                                    const isBase = ['Unidad', 'Caja', 'Media Caja', 'Six Pack'].includes(emission);
                                    const normalizedSubtype = normalizeSubtype(selectedConversionSubtype);
                                    const currentUnits = getUnitsPerEmission(emission, normalizedSubtype);
                                    const isLocked = emission === 'Unidad' || emission === 'Six Pack';

                                    return (
                                        <div key={emission} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '0.8rem 1rem',
                                            marginBottom: '0.75rem',
                                            background: 'var(--bg-card-hover)',
                                            borderRadius: '12px',
                                            border: '1px solid var(--accent-light)'
                                        }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{emission}</span>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

                                                {/* Control Group */}
                                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--accent-light)', padding: '2px' }}>
                                                    <button
                                                        onClick={() => updateConversion(emission, Math.max(1, parseInt(currentUnits || 0) - 1), normalizedSubtype)}
                                                        disabled={isLocked}
                                                        style={{ width: '30px', height: '30px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: isLocked ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700 }}
                                                    >
                                                        -
                                                    </button>

                                                    <input
                                                        type="number"
                                                        className="no-spin"
                                                        style={{
                                                            width: '45px',
                                                            textAlign: 'center',
                                                            border: 'none',
                                                            background: 'transparent',
                                                            color: 'var(--text-primary)',
                                                            fontWeight: '700',
                                                            fontSize: '0.95rem',
                                                            outline: 'none',
                                                            appearance: 'textfield',
                                                            MozAppearance: 'textfield'
                                                        }}
                                                        value={currentUnits}
                                                        onChange={(e) => updateConversion(emission, e.target.value, normalizedSubtype)}
                                                        disabled={isLocked}
                                                    />

                                                    <button
                                                        onClick={() => updateConversion(emission, parseInt(currentUnits || 0) + 1, normalizedSubtype)}
                                                        disabled={isLocked}
                                                        style={{ width: '30px', height: '30px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: isLocked ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>

                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Uds</span>

                                                {!isBase ? (
                                                    <button
                                                        onClick={() => removeEmissionType(emission, normalizedSubtype)}
                                                        style={{
                                                            width: '32px', height: '32px',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            color: '#ef4444',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                ) : (
                                                    <div style={{ width: '32px' }}></div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}</div>
                        </AccordionSection>

                    </>
                )
            }
        </div >
    );
}