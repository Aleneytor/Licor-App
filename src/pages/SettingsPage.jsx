import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useProduct } from '../context/ProductContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { supabase } from '../supabaseClient';
import { Trash2, Plus, Save, ChevronRight, ChevronLeft, CircleDollarSign, Users, Package, Star, Box, Send, LogOut, Moon, Sun, Store, ShoppingBag, Search, ChevronDown, ChevronUp, X, Pencil, Check, ShieldCheck, Key, Zap, Trophy, CheckCircle2, AlertCircle, MessageCircle, Copy, Link, Mail } from 'lucide-react';
import AccordionSection from '../components/AccordionSection';
import StockManager from '../components/StockManager';
import ContainerSelector from '../components/ContainerSelector';
import LicenseStatusBanner from '../components/LicenseStatusBanner';
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
        if (beerName === 'Tercio') {
            setSubtype('Botella Tercio');
        }
    }, [beerName]); // Solo cuando cambia el nombre de la cerveza

    useEffect(() => {
        if (!normalizedQuery || normalizedQuery.length < 2) {
            setIsExpanded(false);
            return;
        }

        // Auto-expand solo con match fuerte
        if (searchScore >= 70) {
            setIsExpanded(true);
        }

        // Cambiar subtype basado en búsqueda
        if (isFuzzyMatch('lata', normalizedQuery) || normalizedQuery.includes('lata')) {
            setSubtype(prev => prev.includes('Lata') ? prev : 'Lata Pequeña');
        } else if (isFuzzyMatch('botella', normalizedQuery) || normalizedQuery.includes('botella')) {
            setSubtype('Botella');
        }
    }, [normalizedQuery, searchScore]); // Solo cuando cambia la búsqueda o el score


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

                {/* Hide selector for Tercio as requested */}
                {beerName !== 'Tercio' && (
                    <div style={{ width: '200px' }} onClick={(e) => e.stopPropagation()}>
                        <ContainerSelector value={subtype} onChange={(val) => {
                            setSubtype(val);
                            setIsExpanded(true);
                        }} />
                    </div>
                )}
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
        if (beerName === 'Tercio') {
            setSubtype('Botella Tercio');
        }

        if (searchFilter && searchFilter.length > 1) {
            setIsExpanded(true);
        } else {
            setIsExpanded(false);
        }
    }, [searchFilter, beerName]);

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

                {beerName !== 'Tercio' && (
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
                                onClick={() => {
                                    setCurrencyMode('USD');
                                    setIsExpanded(true);
                                }}
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
                                onClick={() => {
                                    setCurrencyMode('BS');
                                    setIsExpanded(true);
                                }}
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
                            <ContainerSelector value={subtype} onChange={(val) => {
                                setSubtype(val);
                                setIsExpanded(true);
                            }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>

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
                                        inputMode="decimal"
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
                                        inputMode="decimal"
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
            )
            }

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
            {
                successPopup && (
                    <div
                        onClick={() => setSuccessPopup(null)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 100000,
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
                )
            }
        </div >
    );
};

// --- Sub-component: PlanFeatures ---
const PlanFeatures = ({ features, light = false }) => (
    <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
    }}>
        {features.map((feature, index) => (
            <li key={index} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.9rem',
                color: light ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)',
                fontWeight: 500
            }}>
                <CheckCircle2 size={16} color="#10B981" />
                {feature}
            </li>
        ))}
    </ul>
);

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
    const location = useLocation();
    const navigate = useNavigate();
    const roleTranslations = {
        'OWNER': 'Administrador',
        'EMPLOYEE': 'Empleado',
        'MANAGER': 'Gerente'
    };

    const [inviteRole, setInviteRole] = useState('EMPLOYEE');
    const [generatedInviteLink, setGeneratedInviteLink] = useState('');
    const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);
    const [isEditingCustomRate, setIsEditingCustomRate] = useState(false);
    const [draftCustomRate, setDraftCustomRate] = useState('');
    const [inviteStatus, setInviteStatus] = useState('');
    const [historyModalOpen, setHistoryModalOpen] = useState(false); // NEW History Modal state
    const [currentView, setCurrentView] = useState('main');
    const [openSections, setOpenSections] = useState({ beers: true });
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
    const [selectedPlanTab, setSelectedPlanTab] = useState('free'); // 'free', 'monthly', 'yearly'
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [isActivating, setIsActivating] = useState(false);

    const WHATSAPP_NUMBER = "584220131019";

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // --- Team Management Logic ---
    const [teamMembers, setTeamMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Fetch Team Members
    const fetchTeamMembers = async () => {
        if (!organizationId) return;
        setLoadingMembers(true);
        try {
            // Fetch ALL profiles in org
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('organization_id', organizationId);

            if (error) throw error;

            // Filter out current user for the list, but keep data if needed
            setTeamMembers(data.filter(m => m.id !== user.id) || []);
        } catch (err) {
            console.error('Error fetching team:', err);
            // Don't show error on first load to avoid spam if permissions aren't ready
        } finally {
            setLoadingMembers(false);
        }
    };

    // Load team when viewing 'users'
    useEffect(() => {
        if (currentView === 'users' && organizationId) {
            fetchTeamMembers();
        }
    }, [currentView, organizationId]);

    // Delete Member Logic
    const handleDeleteMember = async (memberId) => {
        if (!window.confirm("¿Estás seguro de que quieres eliminar a este usuario? Esta acción borrará su cuenta permanentemente.")) return;

        try {
            const { error } = await supabase.rpc('delete_team_member', { target_user_id: memberId });

            if (error) throw error;

            showNotification('Usuario eliminado correctamente', 'success');
            // Optimistic update
            setTeamMembers(prev => prev.filter(m => m.id !== memberId));
        } catch (err) {
            console.error('Error deleting member:', err);
            showNotification(err.message || 'Error al eliminar usuario', 'error');
        }
    };

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
                    .select('license_key, is_active, plan_type, license_expires_at, trial_started_at')
                    .eq('id', organizationId)
                    .single();

                if (data) {
                    // Calculate trial info
                    let trialInfo = null;
                    if (data.trial_started_at && !data.is_active) {
                        const trialStart = new Date(data.trial_started_at);
                        const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
                        const now = new Date();
                        const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                        const isActive = daysLeft > 0;

                        trialInfo = {
                            isActive,
                            daysLeft,
                            expiresAt: trialEnd,
                            startedAt: trialStart
                        };
                    }

                    setLicenseInfo({ ...data, trialInfo });
                }
            }
        };
        fetchLicense();
    }, [role, organizationId, currentView]);

    // --- ENSURE TERCIO EXISTS ---
    const tercioCreationAttempted = React.useRef(false);

    useEffect(() => {
        if (!beerTypes || beerTypes.length === 0) return;
        if (!['master', 'owner', 'admin', 'manager', 'developer'].some(r => role?.toLowerCase()?.includes(r))) return;
        if (tercioCreationAttempted.current) return; // Ya intentamos crear Tercio

        const hasTercio = beerTypes.some(b => b.toLowerCase() === 'tercio');
        if (!hasTercio) {
            console.log("Auto-creating constant Tercio product...");
            tercioCreationAttempted.current = true; // Marcar como intentado
            addBeerType('Tercio', '#EA580C');
        }
    }, [beerTypes, role, addBeerType]);

    // URL View Management
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const view = params.get('view');
        if (view === 'activation') {
            setCurrentView('activation');
        }
    }, [location.search]);

    const getPlanLabel = (type) => {
        switch (type?.toLowerCase()) {
            case 'yearly': return 'ANUAL';
            case 'free': return 'PRUEBA GRATUITA';
            case 'monthly': return '30 Días';
            default: return type ? type.toUpperCase() : 'SIN PLAN';
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

        // BLOQUEO DE SEGURIDAD: Solo con licencia activa
        if (!isLicenseActive) {
            showNotification("⚠️ ACCIÓN BLOQUEADA: Debes activar tu suscripción para gestionar empleados.", "error");
            return;
        }

        setInviteStatus('loading');

        try {
            // 1. Generate unique invitation token
            // Polyfill for crypto.randomUUID() in non-secure contexts (local network HTTP)
            let inviteToken;
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                inviteToken = crypto.randomUUID();
            } else {
                // Simple fallback for local dev
                inviteToken = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }

            // 2. Insert generic invitation (no email required)
            const { error: inviteError } = await supabase
                .from('organization_invites')
                .insert([{
                    organization_id: organizationId,
                    role: inviteRole || 'EMPLOYEE',
                    token: inviteToken,
                    status: 'pending',
                    email: null // Generic link - no specific email
                }]);

            if (inviteError) {
                console.error("Error creating invite:", inviteError);
                throw new Error("Error al generar el link de invitación");
            }

            // 3. Generate invitation link
            const inviteLink = `${window.location.origin}/registro-empleado?token=${inviteToken}`;

            // 4. Copy to clipboard
            try {
                await navigator.clipboard.writeText(inviteLink);
                showNotification(`Link copiado al portapapeles`, 'success');
            } catch (clipErr) {
                console.warn("Could not copy to clipboard:", clipErr);
            }

            // 5. Show modal with link and copy button
            setGeneratedInviteLink(inviteLink);
            setShowInviteLinkModal(true);

            setInviteStatus('success');
            setTimeout(() => setInviteStatus('idle'), 3000);

        } catch (err) {
            console.error(err);
            showNotification(err.message || "Error generando link de invitación", 'error');
            setInviteStatus('error');
        }
    };


    const handleActivateTrial = async () => {
        if (!organizationId) {
            showNotification('No se encontró el ID de la organización. Por favor, recarga la página.', 'error');
            return;
        }

        setIsActivating(true);
        console.log('SettingsPage: Activating trial for org', organizationId);

        try {
            const { error } = await supabase
                .from('organizations')
                .update({
                    trial_started_at: new Date().toISOString(),
                    is_active: false,
                    plan_type: 'free'
                })
                .eq('id', organizationId);

            if (error) {
                console.error('SettingsPage: Supabase error activating trial:', error);
                throw error;
            }

            console.log('SettingsPage: Trial activated successfully. Refreshing license...');
            await refreshLicense(true);
            setShowTrialModal(false);
            showNotification('¡Prueba gratis activada por 7 días!', 'success');

            // Forzar actualización de licenseInfo local
            const { data } = await supabase
                .from('organizations')
                .select('license_key, is_active, plan_type, license_expires_at, trial_started_at')
                .eq('id', organizationId)
                .single();

            if (data) {
                const trialStart = new Date(data.trial_started_at);
                const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
                const now = new Date();
                const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                setLicenseInfo({
                    ...data,
                    trialInfo: { isActive: true, daysLeft, expiresAt: trialEnd, startedAt: trialStart }
                });
            }
        } catch (err) {
            console.error('Error activating trial:', err);
            showNotification('Error al activar la prueba: ' + (err.message || 'Error desconocido'), 'error');
        } finally {
            setIsActivating(false);
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
            showNotification(`Error: ${error.message || 'Error al agregar el producto'}`, 'error');
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

        const SectionSeparator = ({ label }) => (
            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0 2.25rem 0', gap: '1rem' }}>
                <div style={{
                    flex: 1,
                    height: '1px',
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
                }}></div>
                <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: theme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
                    letterSpacing: '1px',
                    textTransform: 'capitalize'
                }}>{label}</span>
                <div style={{
                    flex: 1,
                    height: '1px',
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
                }}></div>
            </div>
        );

        const MenuOption = ({ item }) => {
            const isDisabled = isInactive && !['activation', 'users'].includes(item.id);
            return (
                <button
                    key={item.id}
                    className={`option-btn ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && setCurrentView(item.id)}
                    style={{
                        height: 'auto',
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: '20px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--accent-light)',
                        opacity: isDisabled ? 0.5 : 1,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.25s ease',
                        marginBottom: '0.75rem'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            background: item.color,
                            width: '40px', height: '40px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: '12px', flexShrink: 0,
                            boxShadow: `0 4px 12px ${item.color}33`
                        }}>
                            <item.icon size={20} color="white" />
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.label}
                        </span>

                        {/* STATUS BADGE FOR ACTIVATION */}
                        {item.id === 'activation' && (licenseInfo?.is_active || licenseInfo?.trialInfo?.isActive) && (
                            <div style={{
                                background: '#10b981',
                                color: 'white',
                                fontSize: '0.65rem',
                                fontWeight: 900,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                marginLeft: '8px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                            }}>
                                {licenseInfo?.is_active
                                    ? getPlanLabel(licenseInfo.plan_type)
                                    : `PRUEBA ${licenseInfo?.trialInfo?.daysLeft}D`}
                            </div>
                        )}
                    </div>
                    {!isDisabled && <ChevronRight size={18} color="#999" />}
                </button>
            );
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.5rem' }}>
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

                {/* --- GESTIÓN --- */}
                {role?.toLowerCase() !== 'employee' && (
                    <>
                        <SectionSeparator label="Gestion" />
                        <MenuOption item={{ id: 'products', label: 'Gestion de Productos', icon: Package, color: '#4ade80' }} />
                        <MenuOption item={{ id: 'dashboard', label: 'Precios Actuales', icon: Star, color: '#3b82f6' }} />
                        <MenuOption item={{ id: 'inventory', label: 'Inventario', icon: Box, color: '#a3e635' }} />
                    </>
                )}

                {/* Employees can ONLY see Dashboard (read-only) */}
                {role?.toLowerCase() === 'employee' && (
                    <>
                        <SectionSeparator label="Consulta" />
                        <MenuOption item={{ id: 'dashboard', label: 'Precios Actuales', icon: Star, color: '#3b82f6' }} />
                    </>
                )}

                {/* --- GENERAL --- */}
                <SectionSeparator label="General" />
                <MenuOption item={{ id: 'bcv', label: 'Tasas', icon: CircleDollarSign, color: '#f97316' }} />
                <MenuOption item={{ id: 'users', label: 'Usuarios', icon: Users, color: '#ef4444' }} />
                {(role && ['master', 'owner', 'admin', 'manager', 'developer'].some(r => role.toLowerCase().includes(r))) && (
                    <MenuOption item={{ id: 'activation', label: 'Activacion', icon: ShieldCheck, color: '#10b981' }} />
                )}

                {/* --- APARIENCIA Y CIERRE (Acercados) --- */}
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div
                        onClick={toggleTheme}
                        style={{
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderRadius: '20px',
                            background: theme === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
                            border: theme === 'dark' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(99, 102, 241, 0.2)',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                background: '#6366f1',
                                width: '40px', height: '40px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                borderRadius: '12px', flexShrink: 0,
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                            }}>
                                <Sun size={20} color="white" />
                            </div>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#6366f1' }}>Apariencia</span>
                        </div>

                        <div style={{
                            width: '46px',
                            height: '24px',
                            background: theme === 'dark' ? '#6366f1' : '#d1d1d6',
                            borderRadius: '20px',
                            padding: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'background 0.3s',
                            position: 'relative'
                        }}>
                            <div style={{
                                width: '18px', height: '18px',
                                background: 'white', borderRadius: '50%',
                                transform: theme === 'dark' ? 'translateX(22px)' : 'translateX(0)',
                                transition: 'all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                            }} />
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        style={{
                            height: 'auto',
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            borderRadius: '20px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            cursor: 'pointer',
                            width: '100%',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <div style={{ background: '#ef4444', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', flexShrink: 0, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)' }}>
                            <LogOut size={20} color="white" />
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444' }}>Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="sales-container-v2" style={{
            padding: isMobile ? '1rem' : '2rem',
            maxWidth: currentView === 'activation' ? '1300px' : '800px',
            margin: '0 auto',
            width: '100%'
        }}>
            {/* Header - Only show for subviews */}
            {currentView !== 'main' && (
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', position: 'relative' }}>
                    <button
                        onClick={() => setCurrentView('main')}
                        style={{ position: 'absolute', left: 0, background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}
                    >
                        <ChevronLeft size={28} color="var(--text-primary)" />
                    </button>
                    <h1 className="payment-section-title" style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', margin: '0 auto', paddingLeft: isMobile ? '32px' : '48px', paddingRight: isMobile ? '32px' : '48px', textAlign: 'center' }}>
                        {currentView === 'bcv' && 'Tasas '}
                        {currentView === 'products' && 'Gestion de Productos'}
                        {currentView === 'dashboard' && 'Precios Actuales'}
                        {currentView === 'users' && 'Usuarios'}
                        {currentView === 'inventory' && 'Inventario'}
                        {currentView === 'activation' && 'Activación de Licencia'}
                    </h1>
                </div>
            )}

            {/* License Status Banner - Solo en vista principal si no hay licencia activa */}
            {currentView === 'main' && !isLicenseActive && (
                <div
                    onClick={() => {
                        console.log('Banner click triggered');
                        setShowTrialModal(true);
                    }}
                    style={{ cursor: 'pointer', width: '100%', pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
                >
                    <LicenseStatusBanner onTrialClick={() => setShowTrialModal(true)} />
                </div>
            )}

            {currentView === 'main' && <MainMenu />}


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
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000
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


                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {Array.isArray(beerTypes) && [...beerTypes]
                            .filter(beer => beer.toLowerCase() !== 'tercio')
                            .sort((a, b) => {
                                if (!searchQuery || searchQuery.length < 2) return 0;
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
                    </div>

                    <div style={{ margin: '1rem 0', height: '1px', background: 'var(--accent-light)', opacity: 0.5 }}></div>

                    {/* --- CONSTANT TERCIO SECTION AT THE BOTTOM --- */}
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '1rem',
                            padding: '0 0.5rem',
                            color: '#EA580C',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                        }}>
                            <Star size={14} fill="#EA580C" />
                            <span>Precio Maestro: Tercio (Formato Especial)</span>
                        </div>
                        {isEditMode ? (
                            <BeerPriceEditor beerName="Tercio" searchFilter="" />
                        ) : (
                            <BeerDashboardCard beerName="Tercio" searchFilter="" />
                        )}
                    </div>
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
                    <div className="order-summary-card" style={{ maxWidth: '1000px', margin: '0 auto', padding: '0' }}>
                        <div style={{ padding: isMobile ? '1.5rem' : '2.5rem' }}>
                            <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                                <div style={{ width: '64px', height: '64px', background: 'var(--bg-card-hover)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                                    <Users size={32} color="var(--text-primary)" />
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Gestión de Equipo</h2>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                    Organización: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{organizationName || 'Cargando...'}</span>
                                </p>
                            </div>

                            {/* 1. SECCIÓN MIS DATOS */}
                            <div style={{ marginBottom: '2.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '4px', height: '20px', background: '#3b82f6', borderRadius: '4px' }}></div>
                                    Mis Datos
                                </h3>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '1.5rem',
                                    background: 'var(--bg-card-hover)', padding: '1.5rem', borderRadius: '20px',
                                    border: '1px solid var(--accent-light)',
                                    flexWrap: 'wrap'
                                }}>
                                    <div style={{
                                        width: '60px', height: '60px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 700, fontSize: '1.5rem'
                                    }}>
                                        {user?.email?.[0].toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                            {user?.user_metadata?.full_name || 'Tú'}
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Mail size={16} /> {user?.email}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '6px 16px', borderRadius: '12px',
                                        background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                                        fontWeight: 700, fontSize: '0.9rem', border: '1px solid rgba(59, 130, 246, 0.2)'
                                    }}>
                                        {roleTranslations[role] || role}
                                    </div>
                                </div>
                            </div>

                            {/* 2. TABLA DE MIEMBROS */}
                            <div style={{ marginBottom: '3rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '4px', height: '20px', background: '#10b981', borderRadius: '4px' }}></div>
                                    Miembros del Equipo
                                </h3>

                                {loadingMembers ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando equipo...</div>
                                ) : teamMembers.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-card-hover)', borderRadius: '16px', color: 'var(--text-muted)' }}>
                                        No hay otros miembros en tu equipo aún.
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--accent-light)' }}>
                                                    <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>USUARIO</th>
                                                    <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ROL</th>
                                                    <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>FECHA INGRESO</th>
                                                    <th style={{ textAlign: 'right', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ACCIONES</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {teamMembers.map(member => (
                                                    <tr key={member.id} style={{ borderBottom: '1px solid var(--accent-light)' }}>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{member.full_name || 'Sin Nombre'}</div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{member.email}</div>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <span style={{
                                                                padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700,
                                                                background: member.role === 'MANAGER' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                                color: member.role === 'MANAGER' ? '#f59e0b' : '#10b981'
                                                            }}>
                                                                {roleTranslations[member.role] || member.role}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                            {new Date(member.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                            {(role === 'OWNER' || role === 'master' || role === 'MANAGER') && (
                                                                <button
                                                                    onClick={() => handleDeleteMember(member.id)}
                                                                    title="Eliminar usuario"
                                                                    style={{
                                                                        background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none',
                                                                        width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer',
                                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                                                                    }}
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* 3. SECCIÓN INVITAR (Mantenida) */}
                            {(role === 'OWNER' || role === 'master' || role === 'MANAGER' || !role) && (
                                <div style={{ background: 'var(--bg-card-hover)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--accent-light)' }}>
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '4px', height: '20px', background: 'var(--text-primary)', borderRadius: '4px' }}></div>
                                        Invitar Nuevo Usuario
                                    </h3>

                                    {!isLicenseActive && (
                                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertCircle size={18} />
                                            Requiere Suscripción Activa para invitar
                                        </div>
                                    )}

                                    <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', pointerEvents: isLicenseActive ? 'auto' : 'none', opacity: isLicenseActive ? 1 : 0.6 }}>
                                        <div>
                                            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Rol a asignar</label>
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    value={inviteRole}
                                                    onChange={(e) => setInviteRole(e.target.value)}
                                                    className="ticket-input-large"
                                                    style={{ width: '100%', appearance: 'none' }}
                                                >
                                                    <option value="EMPLOYEE">Empleado (Ventas)</option>
                                                    <option value="MANAGER">Administrador (Gestión Total)</option>
                                                </select>
                                                <ChevronDown size={20} color="var(--text-secondary)" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={inviteStatus === 'loading'}
                                            className="btn-primary-gradient"
                                            style={{ padding: '1rem', borderRadius: '16px', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                        >
                                            {inviteStatus === 'loading' ? (
                                                <>Generating...</>
                                            ) : (
                                                <>
                                                    <Link size={20} />
                                                    Generar Link de Invitación
                                                </>
                                            )}
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
                    <div className="order-summary-card" style={{
                        maxWidth: '1200px',
                        width: '100%',
                        margin: '0 auto',
                        padding: 0 // Remove default card padding to use our local padding
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: isMobile ? '2.5rem' : '4rem',
                            padding: isMobile ? '1.5rem' : '3.5rem',
                            justifyContent: 'center',
                            alignItems: 'flex-start'
                        }}>

                            {/* --- LEFT COLUMN: PLANS & ACTIVATION (60%) --- */}
                            <div style={{ flex: isMobile ? '1' : '0 1 60%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-start' }}>
                                <div style={{ textAlign: isMobile ? 'center' : 'left', marginBottom: '3rem' }}>
                                    <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                                        {role?.toLowerCase() === 'developer' ? 'Modo Desarrollador' : 'Activar Producto'}
                                    </h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '500px' }}>
                                        {role?.toLowerCase() === 'developer'
                                            ? 'Tienes acceso total e ilimitado a todas las funciones del sistema por ser Administrador de Sistema.'
                                            : 'Elige el plan que mejor se adapte a tus necesidades y desbloquea todas las funciones premium.'}
                                    </p>
                                </div>

                                {role?.toLowerCase() !== 'developer' && (
                                    <>
                                        {/* PRICING PLANS SECTION */}
                                        <div style={{ marginBottom: '4rem' }}>
                                            {/* PLAN SELECTOR */}
                                            <div style={{
                                                background: 'var(--bg-card-hover)',
                                                padding: '6px',
                                                borderRadius: '16px',
                                                display: 'inline-flex',
                                                gap: '4px',
                                                border: '1px solid var(--accent-light)',
                                                marginBottom: '2rem',
                                                boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
                                            }}>
                                                {[
                                                    { id: 'free', label: 'FREE' },
                                                    { id: 'monthly', label: '30 DÍAS' },
                                                    { id: 'yearly', label: '1 AÑO' }
                                                ].map(tab => (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setSelectedPlanTab(tab.id)}
                                                        style={{
                                                            padding: '10px 24px',
                                                            borderRadius: '12px',
                                                            border: 'none',
                                                            background: selectedPlanTab === tab.id ? '#10B981' : 'transparent',
                                                            color: selectedPlanTab === tab.id ? 'white' : 'var(--text-secondary)',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 800,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                    >
                                                        {tab.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* PLAN CARD */}
                                            <div style={{ width: '100%', maxWidth: '500px' }}>
                                                {selectedPlanTab === 'free' && (
                                                    <div style={{ background: 'var(--bg-card-hover)', padding: '2rem', borderRadius: '24px', border: '1px solid #10B981', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Prueba Gratis</h3>
                                                        <div style={{ fontSize: '2.5rem', fontWeight: 900, margin: '1rem 0' }}>$0</div>
                                                        <button
                                                            onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20quisiera%20solicitar%20mi%20Plan%20Prueba%20Gratis!`, '_blank')}
                                                            className="btn-primary-gradient"
                                                            style={{ width: '100%', height: '54px', marginBottom: '1.5rem' }}
                                                        >
                                                            Solicitar Prueba
                                                        </button>
                                                        <PlanFeatures features={['30 días de acceso', 'Todas las funciones', 'Soporte estándar']} />
                                                    </div>
                                                )}
                                                {selectedPlanTab === 'monthly' && (
                                                    <div style={{ background: 'var(--text-primary)', color: 'var(--bg-card)', padding: '2.5rem 2rem', borderRadius: '24px', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                                                        <div style={{ position: 'absolute', top: '-12px', right: '20px', background: '#f97316', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>POPULAR</div>
                                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Plan Mensual</h3>
                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '1rem 0' }}>
                                                            <span style={{ fontSize: '2.5rem', fontWeight: 900 }}>$10</span>
                                                            <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>$15</span>
                                                        </div>
                                                        <button
                                                            onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20quisiera%20adquirir%20el%20Plan%20Mensual!`, '_blank')}
                                                            style={{ width: '100%', height: '54px', background: '#10B981', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', marginBottom: '1.5rem' }}
                                                        >
                                                            Suscribirse Ahora
                                                        </button>
                                                        <PlanFeatures features={['Sincronización Realtime', 'Multi-dispositivo', 'Soporte Prioritario']} light />
                                                    </div>
                                                )}
                                                {selectedPlanTab === 'yearly' && (
                                                    <div style={{ background: 'var(--bg-card-hover)', padding: '2rem', borderRadius: '24px', border: '1px solid #10B981', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Plan Anual</h3>
                                                        <div style={{ fontSize: '2.5rem', fontWeight: 900, margin: '1rem 0' }}>$90</div>
                                                        <button
                                                            onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hola,%20quisiera%20adquirir%20el%20Plan%20Anual!`, '_blank')}
                                                            className="btn-primary-gradient"
                                                            style={{ width: '100%', height: '54px', marginBottom: '1.5rem' }}
                                                        >
                                                            Adquirir Plan
                                                        </button>
                                                        <PlanFeatures features={['Todo el Plan Mensual', '2 Meses Gratis', 'Soporte VIP 24/7']} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ACTIVATION FORM */}
                                        {!licenseInfo?.is_active && (
                                            <div style={{ borderTop: '1px solid var(--accent-light)', paddingTop: '3.5rem', width: '100%', maxWidth: '600px' }}>
                                                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem', textAlign: isMobile ? 'center' : 'left' }}>¿Ya tienes una clave?</h3>
                                                <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="XXXX-XXXX-XXXX-XXXX"
                                                        value={activationKey}
                                                        onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
                                                        className="ticket-input-large"
                                                        style={{ width: '100%', height: '64px', fontSize: '1.2rem', letterSpacing: '3px', textAlign: 'center', borderRadius: '18px' }}
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={activationStatus.loading || !activationKey}
                                                        className="btn-primary-gradient"
                                                        style={{ width: '100%', height: '60px', fontSize: '1.1rem', fontWeight: 900, borderRadius: '18px', boxShadow: '0 10px 20px rgba(255, 140, 0, 0.2)' }}
                                                    >
                                                        {activationStatus.loading ? 'ACTIVANDO...' : 'Activar Licencia Ahora'}
                                                    </button>
                                                </form>
                                                {activationStatus.error && <p style={{ color: '#ef4444', fontSize: '0.95rem', marginTop: '1rem', fontWeight: 600, textAlign: 'center' }}>{activationStatus.error}</p>}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* --- RIGHT COLUMN: SIDEBAR STATUS (40%) --- */}
                            <div style={{
                                flex: isMobile ? '1' : '0 0 38%',
                                width: '100%',
                                position: isMobile ? 'static' : 'sticky',
                                top: '2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.5rem'
                            }}>

                                {/* UNIFIED STATUS CARD */}
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '24px',
                                    padding: '2rem',
                                    border: '1px solid var(--accent-light)',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Estado del Sistema</h3>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '99px',
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            background: (licenseInfo?.is_active || licenseInfo?.trialInfo?.isActive || role?.toLowerCase() === 'developer') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: (licenseInfo?.is_active || licenseInfo?.trialInfo?.isActive || role?.toLowerCase() === 'developer') ? '#10b981' : '#ef4444'
                                        }}>
                                            {(licenseInfo?.is_active || licenseInfo?.trialInfo?.isActive || role?.toLowerCase() === 'developer') ? 'ACTIVO' : 'INACTIVO'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Plan Actual</span>
                                            <span style={{ fontWeight: 800, color: '#3b82f6', fontSize: '1rem' }}>
                                                {role?.toLowerCase() === 'developer' ? 'DESARROLLADOR' :
                                                    (licenseInfo?.is_active ? getPlanLabel(licenseInfo.plan_type) :
                                                        (licenseInfo?.trialInfo?.isActive ? 'PRUEBA 7 DÍAS' : 'NINGUNO'))}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Vencimiento</span>
                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {role?.toLowerCase() === 'developer' ? 'NUNCA' :
                                                    (licenseInfo?.is_active ? new Date(licenseInfo.license_expires_at).toLocaleDateString() :
                                                        (licenseInfo?.trialInfo?.isActive ? new Date(licenseInfo.trialInfo.expiresAt).toLocaleDateString() : '---'))}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Clave Activa</span>
                                            <code style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.9rem', color: '#10b981' }}>
                                                {licenseInfo?.license_key ? `••••${licenseInfo.license_key.slice(-4)}` : '•••• ••••'}
                                            </code>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--accent-light)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <AlertCircle size={18} color="var(--text-secondary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                                            Mantén tu clave segura. No la compartas con nadie para evitar problemas de acceso.
                                        </p>
                                    </div>
                                </div>
                            </div>
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

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                        <div style={{ minWidth: '140px' }}>
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
                                                        inputMode="numeric"
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

            {/* Modal de prueba gratuita */}
            {showTrialModal && (
                <>
                    <div
                        onClick={() => setShowTrialModal(false)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.7)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 100000,
                            padding: '1rem',
                            animation: 'fadeIn 0.2s ease'
                        }}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'var(--bg-card)',
                                borderRadius: '24px',
                                maxWidth: '500px',
                                width: '100%',
                                overflow: 'hidden',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                                animation: 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                                border: '1px solid rgba(255, 140, 0, 0.2)'
                            }}
                        >
                            {/* Header con gradiente y rayito */}
                            <div style={{
                                background: 'linear-gradient(135deg, #FF8C00 0%, #FF7900 100%)',
                                padding: '1.5rem',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 2s infinite'
                                }} />

                                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        background: 'rgba(255, 121, 0, 0.2)',
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid rgba(255,255,255,0.4)',
                                        animation: 'pulse 2s infinite'
                                    }}>
                                        <Zap size={32} color="white" fill="white" />
                                    </div>
                                    <h3 style={{ margin: 0, color: 'white', fontSize: '1.75rem', fontWeight: 900, textAlign: 'center' }}>Prueba Gratuita</h3>
                                </div>
                            </div>

                            <div style={{ padding: '2rem' }}>
                                <p style={{ margin: '0 0 1.5rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 500 }}>
                                    ¡Desbloquea 7 días de acceso total y lleva tu negocio al siguiente nivel!
                                </p>

                                <div className="benefits-modal-grid-settings" style={{
                                    display: 'grid',
                                    gap: '1rem',
                                    marginBottom: '2rem'
                                }}>
                                    <div style={{ background: 'var(--bg-card-hover)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <CheckCircle2 color="#10b981" size={20} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cuentas Ilimitadas</span>
                                    </div>
                                    <div style={{ background: 'var(--bg-card-hover)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <CheckCircle2 color="#10b981" size={20} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Multi-usuario</span>
                                    </div>
                                    <div style={{ background: 'var(--bg-card-hover)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <CheckCircle2 color="#10b981" size={20} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Soporte Realtime</span>
                                    </div>
                                    <div style={{ background: 'var(--bg-card-hover)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <CheckCircle2 color="#10b981" size={20} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Estadísticas VIP</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleActivateTrial}
                                    disabled={isActivating}
                                    style={{
                                        width: '100%',
                                        padding: '1.25rem',
                                        borderRadius: '16px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white',
                                        border: 'none',
                                        fontSize: '1.1rem',
                                        fontWeight: 800,
                                        cursor: isActivating ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Zap size={20} fill="white" />
                                    {isActivating ? 'Configurando...' : 'Activar Prueba'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <style>{`
                            .benefits-modal-grid-settings { grid-template-columns: repeat(2, 1fr); }
                            @media (max-width: 640px) {
                                .benefits-modal-grid-settings { grid-template-columns: 1fr; }
                            }
                            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                            @keyframes bounceIn {
                                0% { transform: scale(0.3); opacity: 0; }
                                50% { transform: scale(1.05); }
                                70% { transform: scale(0.9); }
                                100% { transform: scale(1); opacity: 1; }
                            }
                            @keyframes shimmer {
                                0% { background-position: -200% center; }
                                100% { background-position: 200% center; }
                            }
                            @keyframes pulse {
                                0%, 100% { transform: scale(1); }
                                50% { transform: scale(1.05); }
                            }
                        `}</style>
                </>
            )
            }
            {showInviteLinkModal && (
                <div
                    onClick={() => setShowInviteLinkModal(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 100000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            padding: '2.5rem',
                            borderRadius: '24px',
                            boxShadow: 'var(--shadow-lg)',
                            width: '90%',
                            maxWidth: '480px',
                            border: '1px solid var(--accent-light)',
                            textAlign: 'center'
                        }}
                    >
                        <div style={{
                            width: '64px', height: '64px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem auto'
                        }}>
                            <CheckCircle2 size={32} color="#10b981" />
                        </div>

                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 700 }}>
                            Link de Invitación Generado
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                            Comparte este link con la persona que quieres invitar como <strong>{inviteRole === 'MANAGER' ? 'Administrador' : 'Empleado'}</strong>
                        </p>

                        <div style={{
                            background: 'var(--bg-input)',
                            padding: '1rem',
                            borderRadius: '16px',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            border: '1px solid var(--accent-light)'
                        }}>
                            <Link size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                            <div style={{
                                wordBreak: 'break-all',
                                fontFamily: 'monospace',
                                fontSize: '0.9rem',
                                color: 'var(--text-primary)',
                                textAlign: 'left',
                                flex: 1
                            }}>
                                {generatedInviteLink}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(generatedInviteLink);
                                        showNotification('Link copiado al portapapeles', 'success');
                                    } catch (err) {
                                        showNotification('Error al copiar el link', 'error');
                                    }
                                }}
                                className="btn-primary-gradient"
                                style={{
                                    flex: 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    borderRadius: '14px',
                                    padding: '0.8rem',
                                    fontSize: '0.95rem',
                                    border: 'none',
                                    color: 'white'
                                }}
                            >
                                <Copy size={18} />
                                <span>Copiar Link</span>
                            </button>
                            <button
                                onClick={() => setShowInviteLinkModal(false)}
                                style={{
                                    flex: 1,
                                    background: 'var(--bg-card-hover)',
                                    color: 'var(--text-primary)',
                                    padding: '0.8rem',
                                    borderRadius: '14px',
                                    border: '1px solid var(--accent-light)',
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
