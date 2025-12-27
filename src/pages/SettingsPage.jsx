import React, { useState, useEffect } from 'react';
import { useProduct } from '../context/ProductContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { supabase } from '../supabaseClient';
import { Trash2, Plus, Save, ChevronRight, ChevronLeft, CircleDollarSign, Users, Package, Star, Box, Send, LogOut, Moon, Sun, Store, ShoppingBag, Search, ChevronDown, ChevronUp, X, Pencil, Check, ShieldCheck, Key } from 'lucide-react';
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

const formatDate = (dateString) => {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
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
        currentRate,
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
        const rate = currentRate || 0;
        return (usd * rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs';
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
        updatePrice, currencySymbol, currentRate
    } = useProduct();
    const { showNotification } = useNotification();
    const { theme } = useTheme();

    // Currency Mode State: 'USD' | 'BS'
    const [currencyMode, setCurrencyMode] = useState('USD');

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
    // Load initial prices when beer/subtype changes OR Currency Mode changes
    useEffect(() => {
        const initialMap = {};
        const rate = currentRate || 1; // Avoid div by zero

        emissions.forEach(emi => {
            const stdUSD = getPrice(beerName, emi, subtype);
            const locUSD = getPrice(beerName, emi, subtype, 'local');

            // Calculate based on mode
            const stdVal = currencyMode === 'USD' ? stdUSD : (stdUSD * rate);
            const locVal = currencyMode === 'USD' ? locUSD : (locUSD * rate);

            initialMap[emi] = {
                standard: stdVal > 0 ? (currencyMode === 'USD' ? stdVal : stdVal.toFixed(2)) : '',
                local: locVal > 0 ? (currencyMode === 'USD' ? locVal : locVal.toFixed(2)) : ''
            };
        });
        setPriceMap(initialMap);
    }, [beerName, subtype, emissions, getPrice, currencyMode, currentRate]);

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
        const rate = currentRate || 1;

        Object.entries(priceMap).forEach(([emission, values]) => {
            // Helper to get raw USD value from input
            const getUsdValue = (inputStr) => {
                const val = parseFloat(inputStr);
                if (isNaN(val)) return 0;
                return currencyMode === 'USD' ? val : (val / rate);
            };

            // Update Standard
            if (values.standard !== '') {
                const oldPrice = getPrice(beerName, emission, subtype, 'standard');
                const newPrice = getUsdValue(values.standard);
                // Check diff with epsilon for float precision
                if (Math.abs(oldPrice - newPrice) > 0.001) {
                    changes.push({ emission, type: 'Llevar', old: oldPrice, new: newPrice });
                    updatePrice(beerName, emission, subtype, newPrice, false);
                }
            }
            // Update Local
            if (values.local !== '') {
                const oldPrice = getPrice(beerName, emission, subtype, 'local');
                const newPrice = getUsdValue(values.local);
                if (Math.abs(oldPrice - newPrice) > 0.001) {
                    changes.push({ emission, type: 'Local', old: oldPrice, new: newPrice });
                    updatePrice(beerName, emission, subtype, newPrice, true);
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
                className="price-editor-header"
                style={{
                    marginBottom: isExpanded ? '1.5rem' : '0'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isExpanded ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{beerName}</h3>
                </div>

                <div className="price-editor-controls" onClick={(e) => e.stopPropagation()}>
                    {/* Currency Mode Toggle (Premium Pill Design) */}
                    <div className="currency-toggle-container" style={{
                        position: 'relative',
                        display: 'flex',
                        background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#e5e7eb',
                        borderRadius: '999px',
                        padding: '2px',
                        width: '100px',
                        height: '32px',
                        isolation: 'isolate'
                    }}>
                        {/* The Sliding Pill */}
                        <div style={{
                            position: 'absolute',
                            top: '2px',
                            bottom: '2px',
                            left: '2px',
                            width: 'calc(50% - 2px)',
                            background: '#10b981',
                            borderRadius: '999px',
                            transform: currencyMode === 'BS' ? 'translateX(100%)' : 'translateX(0)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            zIndex: 1
                        }} />

                        {/* USD Option */}
                        <button
                            onClick={() => setCurrencyMode('USD')}
                            style={{
                                flex: 1,
                                border: 'none',
                                background: 'transparent',
                                color: currencyMode === 'USD' ? 'white' : '#6b7280',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                zIndex: 2,
                                cursor: 'pointer',
                                transition: 'color 0.3s'
                            }}
                        >
                            USD
                        </button>

                        {/* BS Option */}
                        <button
                            onClick={() => setCurrencyMode('BS')}
                            style={{
                                flex: 1,
                                border: 'none',
                                background: 'transparent',
                                color: currencyMode === 'BS' ? 'white' : '#6b7280',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                zIndex: 2,
                                cursor: 'pointer',
                                transition: 'color 0.3s'
                            }}
                        >
                            BS
                        </button>
                    </div>

                    <div className="subtype-selector-container" style={{ width: '180px', display: 'flex', alignItems: 'center' }}>
                        <ContainerSelector value={subtype} onChange={setSubtype} />
                    </div>
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
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.7 }}>PARA LLEVAR ({currencyMode === 'USD' ? currencySymbol : 'Bs.'})</span>
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
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'right', marginTop: '2px', opacity: 0.8 }}>
                                        {currencyMode === 'BS'
                                            ? `≈ ${currencySymbol}${(parseFloat(priceMap[emission]?.standard || 0) / (currentRate || 1)).toFixed(2)}`
                                            : `≈ Bs. ${(parseFloat(priceMap[emission]?.standard || 0) * (currentRate || 1)).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`}
                                    </span>
                                </div>

                                {/* Local */}
                                <div style={{ background: 'var(--bg-card-hover)', padding: '0.75rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        <Store size={14} color="var(--text-secondary)" />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.7 }}>LOCAL ({currencyMode === 'USD' ? currencySymbol : 'Bs.'})</span>
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
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'right', marginTop: '2px', opacity: 0.8 }}>
                                        {currencyMode === 'BS'
                                            ? `≈ ${currencySymbol}${(parseFloat(priceMap[emission]?.local || 0) / (currentRate || 1)).toFixed(2)}`
                                            : `≈ Bs. ${(parseFloat(priceMap[emission]?.local || 0) * (currentRate || 1)).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`}
                                    </span>
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
                
                .price-editor-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                }

                .price-editor-controls {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                @media (max-width: 600px) {
                    .price-editor-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 16px;
                    }

                    .price-editor-controls {
                        width: 100%;
                        justify-content: space-between;
                        gap: 8px;
                    }
                    
                    .currency-toggle-container {
                        flex-shrink: 0;
                    }

                    .subtype-selector-container {
                        width: auto !important;
                        flex: 1;
                        max-width: 180px;
                    }
                }
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
        exchangeRates = {}, fetchRates, updateCustomRate,
        conversions, updateConversion, subtypes, getUnitsPerEmission,
        checkAggregateStock, getBeerColor, updateBeerColor,
        mainCurrency, setMainCurrency
    } = useProduct();

    const { user, role, organizationId, organizationName, isLicenseActive, refreshLicense, logout } = useAuth();
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
    const [isEditingCustomRate, setIsEditingCustomRate] = useState(false);
    const [draftCustomRate, setDraftCustomRate] = useState('');
    const [inviteStatus, setInviteStatus] = useState('');
    const [historyModalOpen, setHistoryModalOpen] = useState(false); // NEW History Modal state
    const [currentView, setCurrentView] = useState('main');
    const [openSections, setOpenSections] = useState({ beers: true });
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

    // Invite State (Already declared above)
    const [activationKey, setActivationKey] = useState('');
    const [activationStatus, setActivationStatus] = useState({ loading: false, success: false, error: '' });
    const [licenseInfo, setLicenseInfo] = useState(null);

    // Fetch license info on load
    useEffect(() => {
        const fetchLicense = async () => {
            if (role && ['master', 'owner', 'admin', 'manager', 'developer'].some(r => role.toLowerCase().includes(r))) {
                const { data, error } = await supabase
                    .from('organizations')
                    .select('license_key, is_active, plan_type, license_expires_at')
                    .eq('id', organizationId)
                    .single();
                if (data) setLicenseInfo(data);
            }
        };
        fetchLicense();
    }, [role, organizationId, currentView]);

    const getPlanLabel = (type) => {
        switch (type?.toLowerCase()) {
            case 'yearly': return 'ANUAL';
            case 'free': return 'PRUEBA GRATUITA';
            case 'monthly': return '30 Días';
            default: return type?.toUpperCase() || 'PREMIUM';
        }
    };

    const handleActivate = async (e) => {
        e.preventDefault();
        setActivationStatus({ loading: true, success: false, error: '' });

        try {
            // 1. Check key in database
            const { data: keyData, error: keyError } = await supabase
                .from('license_keys')
                .select('*')
                .eq('key', activationKey)
                .eq('status', 'available')
                .single();

            if (keyError || !keyData) {
                throw new Error("Clave inválida, expirada o ya utilizada.");
            }

            // 2. Mark key as used (CRITICAL: We do this before updating org to ensure it's not reused)
            const { data: updateCheck, error: markError } = await supabase
                .from('license_keys')
                .update({
                    status: 'used',
                    used_by_org_id: organizationId,
                    used_at: new Date().toISOString()
                })
                .eq('id', keyData.id)
                .eq('status', 'available') // Double check availability during update
                .select();

            if (markError || !updateCheck || updateCheck.length === 0) {
                throw new Error("No se pudo procesar la llave. Quizás ya fue utilizada.");
            }

            // 3. Update organization
            const activationDate = new Date();
            const expirationDate = new Date();

            if (keyData.plan_type === 'yearly') {
                expirationDate.setFullYear(activationDate.getFullYear() + 1);
            } else {
                expirationDate.setDate(activationDate.getDate() + 30);
            }

            const { error } = await supabase
                .from('organizations')
                .update({
                    license_key: activationKey,
                    is_active: true,
                    plan_type: keyData.plan_type || 'premium',
                    license_activated_at: activationDate.toISOString(),
                    license_expires_at: expirationDate.toISOString()
                })
                .eq('id', organizationId);

            if (error) throw error;

            setActivationStatus({ loading: false, success: true, error: '' });
            showNotification('¡Licencia activada correctamente!', 'success');

            // Refresh global auth state immediately
            await refreshLicense(true);

            // Refresh info
            setLicenseInfo(prev => ({
                ...prev,
                license_key: activationKey,
                is_active: true,
                plan_type: keyData.plan_type || 'premium',
                license_expires_at: expirationDate.toISOString()
            }));
            setActivationKey('');

            // STAY ON PAGE. Don't redirect so user sees the success state card.

        } catch (err) {
            console.error(err);
            setActivationStatus({ loading: false, success: false, error: err.message || 'Error al activar' });
            showNotification('Error al activar licencia', 'error');
        }
    };

    // --- Actions ---

    const handleInvite = async (e) => {
        e.preventDefault();
        setInviteStatus('loading');

        try {
            // 1. Validate
            if (!inviteEmail) throw new Error("Email requerido");

            // 2. Insert into organization_invites
            const { error: inviteError } = await supabase
                .from('organization_invites')
                .insert([{
                    email: inviteEmail,
                    organization_id: organizationId,
                    role: inviteRole || 'EMPLOYEE'
                }]);

            if (inviteError) throw inviteError;

            showNotification(`Invitación enviada a ${inviteEmail}`, 'success');
            setInviteEmail('');
            setInviteStatus('success');
            setTimeout(() => setInviteStatus('idle'), 3000);

        } catch (err) {
            console.error(err);
            showNotification(err.message || "Error enviando invitación", 'error');
            setInviteStatus('error');
        }
    };

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
    const [newBeerSubtype, setNewBeerSubtype] = useState('Botella'); // 'Botella' | 'Lata'

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

            // Initialize with a 0 price for the standard 'Unidad' emission 
            // of the chosen format so it shows up in dashboard/inventory right away
            await updatePrice(newBeerName.trim(), 'Unidad', newBeerSubtype, 0, false);

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
        if (s.includes('tercio')) return 'Botella Tercio';
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



    const MainMenu = () => {
        const isInactive = isLicenseActive === false;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                {isInactive && (
                    <div style={{
                        background: 'rgba(234, 88, 12, 0.1)',
                        border: '1px solid #f97316',
                        padding: '1rem',
                        borderRadius: '16px',
                        marginBottom: '1rem',
                        textAlign: 'center',
                        color: '#f97316',
                        fontWeight: 600
                    }}>
                        Para usar las funciones del menú Ajustes activa la licencia.
                    </div>
                )}
                {[
                    { id: 'products', label: 'Gestion de Productos', icon: Package, color: '#4ade80' },
                    { id: 'dashboard', label: 'Precios Actuales', icon: Star, color: '#3b82f6' },
                    { id: 'inventory', label: 'Inventario', icon: Box, color: '#a3e635' },
                    { id: 'bcv', label: 'Tasas', icon: CircleDollarSign, color: '#f97316' },
                    { id: 'users', label: 'Usuarios', icon: Users, color: '#ef4444' },
                    { id: 'app', label: 'Apariencia', icon: Sun, color: '#6366f1' },
                    // Only show Activation for Leaders (Including Developer for testing/access)
                    ...((role && ['master', 'owner', 'admin', 'manager', 'developer'].some(r => role.toLowerCase().includes(r))) ? [{ id: 'activation', label: 'Activación', icon: ShieldCheck, color: '#10b981' }] : [])
                ].map(item => {
                    const isDisabled = isInactive && item.id !== 'activation';
                    return (
                        <button
                            key={item.id}
                            className={`option-btn ${isDisabled ? 'disabled' : ''}`}
                            onClick={() => !isDisabled && setCurrentView(item.id)}
                            style={{
                                height: 'auto',
                                padding: '1rem 1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderRadius: '16px',
                                background: 'var(--bg-card)',
                                border: 'none',
                                opacity: isDisabled ? 0.5 : 1,
                                cursor: isDisabled ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: item.color, width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', flexShrink: 0, boxShadow: `0 4px 12px ${item.color}40` }}>
                                    <item.icon size={20} color="white" />
                                </div>
                                <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</span>
                            </div>
                            {!isDisabled && <ChevronRight size={20} color="#999" />}
                        </button>
                    );
                })}

                {/* Logout Button */}
                <button
                    onClick={logout}
                    style={{
                        marginTop: '1rem',
                        height: 'auto',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        borderRadius: '16px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        cursor: 'pointer',
                        width: '100%',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                >
                    <div style={{ background: '#ef4444', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', flexShrink: 0, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)' }}>
                        <LogOut size={20} color="white" />
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: '#ef4444' }}>Cerrar Sesión</span>
                </button>
            </div>
        );
    };

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
                    {currentView === 'activation' && 'Activación de Licencia'}
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
                                {exchangeRates.bcv ? `${Number(exchangeRates.bcv).toLocaleString('en-US')} Bs` : '--.-- Bs'}
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
                                {exchangeRates.euro ? `${Number(exchangeRates.euro).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs` : '--.-- Bs'}
                            </div>
                            {exchangeRates.nextRates && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {new Date(exchangeRates.nextRates.date + 'T12:00:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric' })}: {Number(exchangeRates.nextRates.eur).toFixed(2)} Bs
                                </span>
                            )}
                        </div>
                        <div style={{ background: 'var(--bg-card-hover)', padding: '1.25rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #ff950040', position: 'relative', minWidth: '220px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>Tasa Personalizada</span>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '10px' }}>
                                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#ff9500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isEditingCustomRate ? (
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            autoFocus
                                            value={draftCustomRate}
                                            onChange={(e) => {
                                                const rawValue = e.target.value.replace(/,/g, '');
                                                // Permitir vacío, números con punto, o incluso si empezó como NaN permitir borrarlo
                                                if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
                                                    setDraftCustomRate(rawValue);
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    updateCustomRate(draftCustomRate);
                                                    setIsEditingCustomRate(false);
                                                }
                                                if (e.key === 'Escape') {
                                                    setIsEditingCustomRate(false);
                                                }
                                            }}
                                            style={{
                                                background: 'rgba(255, 149, 0, 0.1)',
                                                border: '1px solid #ff950060',
                                                borderRadius: '8px',
                                                outline: 'none',
                                                color: '#ff9500',
                                                fontWeight: 'bold',
                                                fontSize: '1.75rem',
                                                textAlign: 'center',
                                                width: '140px',
                                                padding: '2px 8px'
                                            }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                                            {(!exchangeRates.custom || isNaN(exchangeRates.custom)) ? '0.00' : Number(exchangeRates.custom).toLocaleString('en-US')}
                                        </span>
                                    )}
                                    <span>Bs</span>
                                </div>

                                <button
                                    onClick={() => {
                                        if (isEditingCustomRate) {
                                            updateCustomRate(draftCustomRate);
                                            setIsEditingCustomRate(false);
                                        } else {
                                            const currentVal = exchangeRates.custom;
                                            setDraftCustomRate((!currentVal || isNaN(currentVal)) ? '' : currentVal.toString());
                                            setIsEditingCustomRate(true);
                                        }
                                    }}
                                    style={{
                                        background: isEditingCustomRate ? '#34c759' : 'rgba(128, 128, 128, 0.1)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '36px',
                                        height: '36px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isEditingCustomRate ? 'white' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        flexShrink: 0
                                    }}
                                >
                                    {isEditingCustomRate ? <Save size={18} /> : <Pencil size={16} />}
                                </button>
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
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setMainCurrency('USD')}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '12px',
                                        background: mainCurrency === 'USD' ? '#34c759' : 'transparent',
                                        color: mainCurrency === 'USD' ? 'white' : 'var(--text-secondary)',
                                        border: mainCurrency === 'USD' ? 'none' : '1px solid var(--accent-light)',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Dolar BCV ($)
                                </button>
                                <button
                                    onClick={() => setMainCurrency('EUR')}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '12px',
                                        background: mainCurrency === 'EUR' ? '#3b82f6' : 'transparent',
                                        color: mainCurrency === 'EUR' ? 'white' : 'var(--text-secondary)',
                                        border: mainCurrency === 'EUR' ? 'none' : '1px solid var(--accent-light)',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Euro BCV (€)
                                </button>
                                <button
                                    onClick={() => setMainCurrency('CUSTOM')}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '12px',
                                        background: mainCurrency === 'CUSTOM' ? '#ff9500' : 'transparent',
                                        color: mainCurrency === 'CUSTOM' ? 'white' : 'var(--text-secondary)',
                                        border: mainCurrency === 'CUSTOM' ? 'none' : '1px solid var(--accent-light)',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Tasa Personalizada ($)
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
                            {(role === 'OWNER' || role === 'master' || !role) && (
                                <div style={{ background: 'var(--bg-card-hover)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>Invitar Nuevo Usuario</h3>
                                    <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Email</label>
                                            <input
                                                type="email"
                                                placeholder="usuario@email.com"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                required
                                                className="ticket-input-large"
                                                style={{
                                                    background: 'var(--bg-app)',
                                                    color: 'var(--text-primary)',
                                                    border: '1px solid var(--accent-light)'
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Rol</label>
                                            <select
                                                value={inviteRole}
                                                onChange={(e) => setInviteRole(e.target.value)}
                                                className="ticket-input-large"
                                                style={{
                                                    width: '100%',
                                                    background: 'var(--bg-app)',
                                                    color: 'var(--text-primary)',
                                                    border: '1px solid var(--accent-light)'
                                                }}
                                            >
                                                <option value="EMPLOYEE">Empleado</option>
                                                <option value="OWNER">Administrador</option>
                                            </select>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={inviteStatus === 'loading'}
                                            style={{
                                                background: 'var(--text-primary)',
                                                color: 'var(--bg-card)',
                                                border: 'none',
                                                borderRadius: '12px',
                                                padding: '1rem',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {inviteStatus === 'loading' ? '...' : 'Invitar'}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }



            {
                currentView === 'activation' && (
                    <div className="order-summary-card">
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <div style={{
                                width: '80px', height: '80px',
                                background: licenseInfo?.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 88, 12, 0.1)',
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1.5rem auto'
                            }}>
                                <Key size={40} color={licenseInfo?.is_active ? '#10b981' : '#f97316'} />
                            </div>

                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                                {role === 'DEVELOPER' ? 'Modo Desarrollador' : (licenseInfo?.is_active ? 'Licencia Activa' : 'Activar Producto')}
                            </h2>

                            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
                                {role === 'DEVELOPER'
                                    ? 'Tienes acceso total e ilimitado a todas las funciones del sistema por ser Administrador de Sistema.'
                                    : (licenseInfo?.is_active
                                        ? `Tu licencia ${getPlanLabel(licenseInfo.plan_type)} está funcionando correctamente. Disfruta de todas las funciones.`
                                        : 'Ingresa tu clave de producto única para desbloquear todas las funcionalidades de la aplicación.')}
                            </p>

                            {/* CRITICAL CHECK: Show form ONLY if local state AND global state say it is inactive */}
                            {(!licenseInfo?.is_active && isLicenseActive === false) ? (
                                <form onSubmit={handleActivate} style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ textAlign: 'left' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>Clave de Licencia</label>
                                        <input
                                            type="text"
                                            placeholder="XXXX-XXXX-XXXX-XXXX"
                                            value={activationKey}
                                            onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
                                            className="ticket-input-large"
                                            style={{
                                                textAlign: 'center',
                                                letterSpacing: '2px',
                                                fontWeight: 'bold',
                                                textTransform: 'uppercase'
                                            }}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={activationStatus.loading || !activationKey}
                                        className="btn-primary-gradient"
                                    >
                                        {activationStatus.loading ? 'Activando...' : 'Activar Licencia'}
                                    </button>

                                    {activationStatus.error && (
                                        <p style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                            {activationStatus.error}
                                        </p>
                                    )}
                                </form>
                            ) : (
                                <div style={{ background: 'var(--bg-card-hover)', padding: '1.5rem', borderRadius: '16px', maxWidth: '400px', margin: '0 auto', border: '1px solid var(--accent-light)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Estado</span>
                                        <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Check size={16} /> {role === 'DEVELOPER' ? 'Acceso Vitalicio' : 'Activo'}
                                        </span>
                                    </div>
                                    {role !== 'DEVELOPER' ? (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Próximo cobro</span>
                                                <span style={{ fontWeight: 'bold', color: '#f97316' }}>
                                                    {formatDate(licenseInfo.license_expires_at)}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Plan</span>
                                                <span style={{ fontWeight: 'bold', color: licenseInfo.plan_type?.toLowerCase() === 'free' ? '#94a3b8' : '#3b82f6' }}>
                                                    {getPlanLabel(licenseInfo.plan_type)}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Clave</span>
                                                <span style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>•••• •••• •••• {licenseInfo.license_key ? licenseInfo.license_key.slice(-4) : '****'}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '10px 0', borderTop: '1px solid var(--accent-light)', marginTop: '10px' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Perfil: Administrador de Sistema</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {
                currentView === 'products' && (
                    <>
                        <AccordionSection title="Tipos de Cerveza" isOpen={!!openSections['beers']} onToggle={() => toggleSettingSection('beers')}>
                            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-card-hover)', padding: '1.25rem', borderRadius: '20px', border: '1px solid var(--accent-light)' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                        <button
                                            onClick={(e) => {
                                                const rect = e.target.getBoundingClientRect();
                                                setPickerPos({ top: rect.bottom + 10, left: rect.left });
                                                setShowColorPicker(!showColorPicker);
                                            }}
                                            style={{ width: '32px', height: '32px', borderRadius: '50%', background: newBeerColor, border: '2px solid rgba(0,0,0,0.1)', cursor: 'pointer', flexShrink: 0 }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Ej: Polar Pilsen, Solera..."
                                            className="ticket-input-large"
                                            value={newBeerName}
                                            onChange={(e) => setNewBeerName(e.target.value)}
                                            style={{ flex: 1, padding: '0.75rem 1.25rem', fontSize: '1rem', height: '48px' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' }}>
                                        <div style={{ flex: 1, maxWidth: '200px' }}>
                                            <div style={{
                                                position: 'relative',
                                                display: 'flex',
                                                background: 'var(--bg-app)',
                                                borderRadius: '999px',
                                                padding: '2px',
                                                height: '36px',
                                                isolation: 'isolate'
                                            }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '2px', bottom: '2px', left: '2px',
                                                    width: 'calc(50% - 2px)',
                                                    background: 'var(--text-primary)',
                                                    borderRadius: '999px',
                                                    transform: newBeerSubtype === 'Lata' ? 'translateX(100%)' : 'translateX(0)',
                                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    zIndex: 1
                                                }} />
                                                <button
                                                    onClick={() => setNewBeerSubtype('Botella')}
                                                    style={{ flex: 1, border: 'none', background: 'transparent', color: newBeerSubtype === 'Botella' ? 'var(--bg-card)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', zIndex: 2, cursor: 'pointer' }}
                                                >
                                                    Botella
                                                </button>
                                                <button
                                                    onClick={() => setNewBeerSubtype('Lata')}
                                                    style={{ flex: 1, border: 'none', background: 'transparent', color: newBeerSubtype === 'Lata' ? 'var(--bg-card)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', zIndex: 2, cursor: 'pointer' }}
                                                >
                                                    Lata
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleAddBeer}
                                            className="option-btn selected"
                                            style={{
                                                padding: '0 1.5rem',
                                                height: '40px',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            <Plus size={18} />
                                            <span>Agregar</span>
                                        </button>
                                    </div>
                                </div>

                                {showColorPicker && (
                                    <div style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 1000, background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '20px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--accent-light)', width: '280px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                                            {presetColors.map(color => (
                                                <button key={color} onClick={() => { setNewBeerColor(color); setShowColorPicker(false); }} style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', background: color, border: newBeerColor === color ? '3px solid var(--text-primary)' : '2px solid transparent' }} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="options-grid" style={{ gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                                {Array.isArray(beerTypes) && beerTypes
                                    .filter(beer => {
                                        const category = newBeerSubtype.toLowerCase();
                                        const relatedKeys = Object.keys(prices).filter(key => key.startsWith(beer + '_'));

                                        // If product has no prices yet, show it so it can be configured
                                        if (relatedKeys.length === 0) return true;

                                        // Otherwise, only show if it has prices for the current format (Botella or Lata)
                                        return relatedKeys.some(key => {
                                            const parts = key.split('_');
                                            const pSubtype = (parts[2] || '').toLowerCase();
                                            return pSubtype.includes(category);
                                        });
                                    })
                                    .map(beer => {
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
                            <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {/* Tercio Toggle */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-card-hover)', borderRadius: '12px', border: '1px solid var(--accent-light)' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Formato Tercio</span>
                                    <button
                                        onClick={() => {
                                            const isTercio = selectedConversionSubtype === 'Botella Tercio';
                                            setSelectedConversionSubtype(isTercio ? 'Botella' : 'Botella Tercio');
                                        }}
                                        style={{
                                            width: '42px',
                                            height: '24px',
                                            borderRadius: '12px',
                                            background: selectedConversionSubtype === 'Botella Tercio' ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '2px',
                                            cursor: 'pointer',
                                            border: 'none',
                                            transition: 'all 0.3s ease',
                                            position: 'relative'
                                        }}
                                    >
                                        <div style={{
                                            width: '20px',
                                            height: '20px',
                                            background: 'white',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transform: selectedConversionSubtype === 'Botella Tercio' ? 'translateX(18px)' : 'translateX(0)',
                                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                        }}>
                                            {selectedConversionSubtype === 'Botella Tercio' && <Check size={12} color="var(--accent-color)" strokeWidth={4} />}
                                        </div>
                                    </button>
                                </div>

                                {selectedConversionSubtype !== 'Botella Tercio' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{
                                            position: 'relative',
                                            display: 'flex',
                                            background: 'var(--bg-app)',
                                            borderRadius: '999px',
                                            padding: '2px',
                                            height: '36px',
                                            isolation: 'isolate',
                                            maxWidth: '200px'
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                top: '2px', bottom: '2px', left: '2px',
                                                width: 'calc(50% - 2px)',
                                                background: 'var(--text-primary)',
                                                borderRadius: '999px',
                                                transform: normalizeSubtype(selectedConversionSubtype) === 'Lata' ? 'translateX(100%)' : 'translateX(0)',
                                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                zIndex: 1
                                            }} />
                                            <button
                                                onClick={() => setSelectedConversionSubtype('Botella')}
                                                style={{ flex: 1, border: 'none', background: 'transparent', color: normalizeSubtype(selectedConversionSubtype) === 'Botella' ? 'var(--bg-card)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', zIndex: 2, cursor: 'pointer' }}
                                            >
                                                Botella
                                            </button>
                                            <button
                                                onClick={() => setSelectedConversionSubtype('Lata Pequeña')}
                                                style={{ flex: 1, border: 'none', background: 'transparent', color: normalizeSubtype(selectedConversionSubtype) === 'Lata' ? 'var(--bg-card)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', zIndex: 2, cursor: 'pointer' }}
                                            >
                                                Lata
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* INPUTS NUEVOS: Nombre (Sin Unidades) - Diseño de Tarjeta */}
                            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem',
                                    background: 'var(--bg-card-hover)',
                                    padding: '1.25rem',
                                    borderRadius: '20px',
                                    border: '1px solid var(--accent-light)'
                                }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            placeholder="Nueva forma (ej: Pack 12, Combo)"
                                            className="ticket-input-large"
                                            value={newEmissionName}
                                            onChange={(e) => setNewEmissionName(e.target.value)}
                                            style={{
                                                flex: 1,
                                                padding: '0.75rem 1.25rem',
                                                fontSize: '1rem',
                                                height: '48px'
                                            }}
                                        />
                                        <button
                                            onClick={handleAddEmission}
                                            className="option-btn selected"
                                            style={{
                                                padding: '0 1.5rem',
                                                height: '48px',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '0.9rem',
                                                minWidth: '120px'
                                            }}
                                        >
                                            <Plus size={18} />
                                            <span>Agregar</span>
                                        </button>
                                    </div>
                                </div>
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