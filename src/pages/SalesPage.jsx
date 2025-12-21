import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AccordionSection from '../components/AccordionSection';
import ContainerSelector from '../components/ContainerSelector';
import { Trash2, ShoppingBag, Store, User, Hash, CheckCircle, PlusCircle, X, AlertTriangle, AlertCircle } from 'lucide-react';
import { useProduct } from '../context/ProductContext';
import { useOrder } from '../context/OrderContext';
import './SalesPage.css';

export default function SalesPage() {
    const navigate = useNavigate();
    const {
        beerTypes, emissionOptions, getPrice, getBsPrice, getUsdPrice, subtypes,
        deductStock, checkStock, getUnitsPerEmission, checkAggregateStock,
        getInventory, getEmissionsForSubtype, currencySymbol
    } = useProduct();
    const { createOrder } = useOrder();

    const [openSection, setOpenSection] = useState('consumption');
    const [showResetModal, setShowResetModal] = useState(false);
    const [stockError, setStockError] = useState(null);

    // --- STATE FOR MAIN ORDER ---
    const [orderState, setOrderState] = useState({
        consumptionMode: null,  // 'Local' | 'Para Llevar'
        emission: null,         // 'Caja', 'Media Caja', 'Unidad'
        subtype: 'Botella',     // 'Botella', 'Lata'
        beerVariety: 'Normal',  // 'Normal' | 'Variado'
        beerType: null,         // Used if Normal OR Local+Variado (as Base)
        quantity: 1,            // Multiplier for the whole pack
    });

    const [cartItems, setCartItems] = useState([]);

    // --- STATE FOR MIXED BUILDER (Only for Para Llevar) ---
    const [showMixedBuilder, setShowMixedBuilder] = useState(false);
    const [mixedComposition, setMixedComposition] = useState({});

    // Listen for Menu Reset
    useEffect(() => {
        const handleResetFlow = (e) => {
            if (e.detail === '/vender') {
                setShowResetModal(true);
            }
        };
        window.addEventListener('reset-flow', handleResetFlow);
        return () => window.removeEventListener('reset-flow', handleResetFlow);
    }, []);


    const confirmReset = () => {
        setCartItems([]);
        resetOrderState();
        setCustomerName('');
        setShowResetModal(false);
    };

    const resetOrderState = () => {
        setOrderState({
            consumptionMode: null,
            emission: null,
            subtype: 'Botella',
            beerVariety: 'Normal',
            beerType: null,
            quantity: 1
        });
        setMixedComposition({});
        setShowMixedBuilder(false);
        setOpenSection('consumption');
        setTicketStep(0);
    };

    // --- HELPER: MIXED CALCULATIONS ---
    const getMixedTotalUnits = () => {
        return Object.values(mixedComposition).reduce((a, b) => a + b, 0);
    };

    const getTargetUnits = () => {
        if (!orderState.emission) return 0;
        if (typeof getUnitsPerEmission !== 'function') return 1;
        return getUnitsPerEmission(orderState.emission, orderState.subtype) || 1;
    };

    const getMixedPrice = (mode = 'standard') => {
        if (Object.keys(mixedComposition).length === 0) return 0;

        let maxPrice = 0;
        const targetEmission = orderState.emission;
        const targetSubtype = orderState.subtype;

        Object.keys(mixedComposition).forEach(beerName => {
            const price = getPrice(beerName, targetEmission, targetSubtype, mode);
            if (price > maxPrice) maxPrice = price;
        });
        return maxPrice;
    };

    const getMixedBsPrice = (mode = 'standard') => {
        if (Object.keys(mixedComposition).length === 0) return 0;

        let maxPrice = 0;
        const targetEmission = orderState.emission;
        const targetSubtype = orderState.subtype;

        Object.keys(mixedComposition).forEach(beerName => {
            const price = getBsPrice(beerName, targetEmission, targetSubtype, mode);
            if (price > maxPrice) maxPrice = price;
        });
        return maxPrice;
    };

    // --- TOTAL CALCULATIONS (CART + CURRENT) ---
    const calculateTotal = () => {
        let total = 0;

        // 1. Sum Cart items
        cartItems.forEach(item => {
            const mode = item.consumptionMode === 'Local' ? 'local' : 'standard';
            if (item.beerVariety === 'Variado') {
                if (item.consumptionMode === 'Para Llevar') {
                    total += (item.unitPriceBs || 0) * item.quantity;
                } else {
                    // Local Variado: Charge the full pack price (e.g. Media Caja) as requested
                    total += (item.unitPriceBs || 0) * item.quantity;
                }
            } else {
                const price = getBsPrice(item.beerType, item.emission, item.subtype, mode) || 0;
                total += price * item.quantity;
            }
        });

        // 2. Add Current Selection 
        if (orderState.beerType && orderState.emission) {
            const currentMode = orderState.consumptionMode === 'Local' ? 'local' : 'standard';
            if (orderState.beerVariety === 'Normal') {
                const currentPrice = getBsPrice(orderState.beerType, orderState.emission, orderState.subtype, currentMode) || 0;
                total += currentPrice * orderState.quantity;
            } else if (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local') {
                // Local Variado: Charge the price of the Selected Emission (e.g. Media Caja)
                // The user is buying the "Right" to consume a Media Caja.
                const starterPrice = getBsPrice(orderState.beerType, orderState.emission, orderState.subtype, 'local') || 0;
                total += starterPrice * orderState.quantity;
            }
        }

        return total;
    };

    const calculateTotalUsd = () => {
        let total = 0;

        cartItems.forEach(item => {
            const mode = item.consumptionMode === 'Local' ? 'local' : 'standard';
            if (item.beerVariety === 'Variado') {
                if (item.consumptionMode === 'Para Llevar') {
                    total += (item.unitPriceUsd || 0) * item.quantity;
                } else {
                    // Local Variado: Sum the full pack price
                    total += (item.unitPriceUsd || 0) * item.quantity;
                }
            } else {
                const price = getPrice(item.beerType, item.emission, item.subtype, mode) || 0;
                total += price * item.quantity;
            }
        });

        if (orderState.beerType && orderState.emission) {
            const currentMode = orderState.consumptionMode === 'Local' ? 'local' : 'standard';
            if (orderState.beerVariety === 'Normal') {
                const currentPrice = getPrice(orderState.beerType, orderState.emission, orderState.subtype, currentMode) || 0;
                total += currentPrice * orderState.quantity;
            } else if (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local') {
                // Local Variado: Charge price of Selected Emission
                const starterPrice = getPrice(orderState.beerType, orderState.emission, orderState.subtype, 'local') || 0;
                total += starterPrice * orderState.quantity;
            }
        }

        return total;
    };

    const formatCurrency = (amount) => {
        if (isNaN(amount)) return '0,00';
        return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    };

    const formatUsd = (amount) => {
        if (isNaN(amount)) return `${currencySymbol}0.00`;
        return `${currencySymbol}${amount.toFixed(2)}`;
    };

    const currentTotal = calculateTotal();

    const [ticketStep, setTicketStep] = useState(0);
    const [customerName, setCustomerName] = useState('');
    const [ticketNumber, setTicketNumber] = useState(null);
    const [ticketDate, setTicketDate] = useState('');

    const [paymentMethod, setPaymentMethod] = useState(null);
    const [paymentReference, setPaymentReference] = useState('');
    const paymentMethods = ['Pago Movil', 'Efectivo', 'Punto', 'BioPago'];

    const [showModal, setShowModal] = useState(false);

    // --- HANDLERS ---

    const handleConsumptionSelect = (mode) => {
        setOrderState(prev => ({
            ...prev,
            consumptionMode: mode
        }));
        if (mode === 'Local') setShowMixedBuilder(false);
        setOpenSection('emission');
    };

    const handleEmissionSelect = (option) => {
        setOrderState(prev => ({ ...prev, emission: option }));
        setOpenSection('beer');
    };

    const handleVarietyToggle = (variety) => {
        setOrderState(prev => ({ ...prev, beerVariety: variety, beerType: null }));

        if (variety === 'Variado') {
            setMixedComposition({});
            if (orderState.consumptionMode === 'Para Llevar' && orderState.emission) {
                setShowMixedBuilder(true);
            }
        } else {
            setShowMixedBuilder(false);
        }
    };

    const handleBeerSelect = (option) => {
        if (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Para Llevar') return;

        setOrderState(prev => ({ ...prev, beerType: option }));
        setOpenSection(null);
    };

    const toggleSection = (section) => {
        setOpenSection(openSection === section ? null : section);
    };

    // --- MIXED BUILDER HANDLERS (Para Llevar) ---
    const addToMix = (beer) => {
        const currentCount = getMixedTotalUnits();
        const target = getTargetUnits();
        if (currentCount >= target) return;
        if (!checkStock(beer, 'Unidad', orderState.subtype, 1)) return;
        setMixedComposition(prev => ({ ...prev, [beer]: (prev[beer] || 0) + 1 }));
    };

    const removeFromMix = (beer) => {
        setMixedComposition(prev => {
            const current = prev[beer] || 0;
            if (current <= 0) return prev;
            const next = current - 1;
            if (next === 0) {
                const { [beer]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [beer]: next };
        });
    };

    const confirmMixedCase = () => {
        const currentCount = getMixedTotalUnits();
        const target = getTargetUnits();
        if (currentCount !== target) {
            alert(`Debes completar la caja. Llevas ${currentCount} de ${target}.`);
            return;
        }
        const mode = 'standard';
        const finalPriceBs = getMixedBsPrice(mode);
        const finalPriceUsd = getMixedPrice(mode);

        const newItem = {
            id: Date.now(),
            ...orderState,
            beerType: 'Variado',
            composition: { ...mixedComposition },
            unitPriceBs: finalPriceBs,
            unitPriceUsd: finalPriceUsd
        };
        setCartItems(prev => [...prev, newItem]);
        resetOrderState();
    };

    // --- VALIDATION ---
    const validateStock = () => {
        if (orderState.beerVariety === 'Variado') return true;

        const beer = orderState.beerType;
        const subtype = orderState.subtype;
        const emission = orderState.emission;
        const quantity = orderState.quantity;

        setStockError(null);
        if (!beer || !emission) return true;

        const currentSelectionUnits = quantity * getUnitsPerEmission(emission, subtype);
        let totalRequired = currentSelectionUnits;

        const unitsInCart = cartItems.reduce((acc, item) => {
            if (item.beerType === beer && item.subtype === subtype && item.beerVariety === 'Normal') {
                return acc + (item.quantity * getUnitsPerEmission(item.emission, item.subtype));
            }
            return acc;
        }, 0);

        totalRequired += unitsInCart;
        const available = getInventory(beer, subtype);

        if (available < totalRequired) {
            setStockError({
                product: `${beer} ${subtype}`,
                required: totalRequired,
                available: available,
                missing: totalRequired - available
            });
            return false;
        }
        return true;
    };

    // --- CART ACTIONS ---
    const handleAddToCart = () => {
        if (!isSelectionComplete()) return;
        if (!validateStock()) return;

        let newItem = {
            id: Date.now(),
            ...orderState,
        };

        // SPECIAL HANDLING FOR LOCAL VARIADO
        if (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local') {
            newItem = {
                ...newItem,
                beerType: `Variado (${orderState.beerType})`, // Keeping this unique ID for internal logic might be ok, or simlify.
                displayBase: orderState.beerType, // NEW: cleaner display name
                baseBeer: orderState.beerType,
                // Charge price of SELECTED EMISSION (e.g. Media Caja)
                unitPriceBs: getBsPrice(orderState.beerType, orderState.emission, orderState.subtype, 'local') || 0,
                unitPriceUsd: getPrice(orderState.beerType, orderState.emission, orderState.subtype, 'local') || 0
            };
        }

        setCartItems(prev => [...prev, newItem]);
        resetOrderState();
    };

    const handleRemoveFromCart = (id) => {
        const newItems = cartItems.filter(item => item.id !== id);
        setCartItems(newItems);
        if (newItems.length === 0) setTicketStep(0);
    };

    const handleInitialCreateClick = () => {
        if (cartItems.length === 0 && !isSelectionComplete()) return;

        if (isSelectionComplete()) {
            if (!validateStock()) return;
            handleAddToCart();
        }

        setTicketNumber(Math.floor(1000 + Math.random() * 9000));
        const now = new Date();
        setTicketDate(new Intl.DateTimeFormat('es-VE', {
            timeZone: 'America/Caracas',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        }).format(now));

        setTicketStep(2);
    };

    const handleFinalConfirm = () => {
        const hasLocal = cartItems.some(i => i.consumptionMode === 'Local');
        if (ticketStep === 2) {
            if (hasLocal && !customerName.trim()) { alert("Ingresa nombre del cliente."); return; }

            // STRICT PAYMENT VALIDATION FOR ALL ORDERS
            if (!paymentMethod) { alert("Selecciona método de pago para procesar la orden."); return; }
            if (paymentMethod === 'Pago Movil' && !paymentReference.trim()) { alert("Ingresa referencia."); return; }
        }

        const localItems = cartItems.filter(i => i.consumptionMode === 'Local');

        if (localItems.length > 0 || cartItems.length === 0) {
            createOrder(customerName, localItems, 'Local', paymentMethod);
        }

        // Deduct Take Away & Normal Local
        cartItems.forEach(item => {
            if (item.consumptionMode === 'Para Llevar') {
                if (item.beerVariety === 'Variado' && item.composition) {
                    Object.entries(item.composition).forEach(([beer, units]) => {
                        deductStock(beer, 'Unidad', item.subtype, units * item.quantity);
                    });
                } else {
                    deductStock(item.beerType, item.emission, item.subtype, item.quantity);
                }
            } else if (item.consumptionMode === 'Local') {
                // For Local Orders:
                // 1. Normal (Media Caja, Caja): Do NOT deduct stock. Slots start empty (0/N).
                // 2. Variado: Deduct 1 unit (Base Beer) as it starts with 1 slot filled.

                if (item.beerVariety === 'Variado') {
                    // Deduct 1 unit of the base beer
                    // Note: item.beerType might be 'Variado (Base)', use item.baseBeer if available
                    const beerToDeduct = item.baseBeer || item.beerType;
                    // Clean up name if needed (remove 'Variado (...)')? 
                    // Actually SalesConfig sets baseBeer correctly.
                    deductStock(beerToDeduct, 'Unidad', item.subtype, 1);
                }
            }
        });

        if (localItems.length > 0 && !cartItems.some(i => i.consumptionMode === 'Para Llevar')) {
            navigateToPending();
        } else {
            setShowModal(true);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setCartItems([]);
        resetOrderState();
        setCustomerName('');
        setPaymentMethod(null);
        setPaymentReference('');
        setTicketStep(0);
    };

    const navigateToPending = () => { navigate('/pendientes'); closeModal(); };
    const handleClearBill = () => { setCartItems([]); resetOrderState(); };
    const increaseQuantity = () => { setOrderState(prev => ({ ...prev, quantity: prev.quantity + 1 })); };
    const decreaseQuantity = () => { setOrderState(prev => ({ ...prev, quantity: prev.quantity > 1 ? prev.quantity - 1 : 1 })); };

    const VarietyToggle = () => (
        <div className="toggle-switch">
            <button
                className={`toggle-option ${orderState.beerVariety === 'Normal' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleVarietyToggle('Normal'); }}
            >
                Normal
            </button>
            <button
                className={`toggle-option ${orderState.beerVariety === 'Variado' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleVarietyToggle('Variado'); }}
            >
                Variado
            </button>
        </div>
    );

    const isSelectionComplete = () => {
        if (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Para Llevar') return false;
        if (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local') {
            return orderState.emission && orderState.beerType;
        }
        return orderState.consumptionMode && orderState.emission && orderState.beerType;
    };

    const getButtonText = () => {
        if (ticketStep === 2) {
            const hasTakeAway = cartItems.some(i => i.consumptionMode === 'Para Llevar');
            return hasTakeAway ? 'Pagar y Crear' : 'Abrir Ticket';
        }
        return 'Continuar';
    };

    // --- HELPER FOR SELECTION LABEL ---
    const getBeerSelectionLabel = () => {
        if (!orderState.beerType) {
            // No beer selected yet
            if (orderState.beerVariety === 'Variado') {
                return orderState.consumptionMode === 'Local'
                    ? 'Ticket Abierto'
                    : 'Variado (Constructor)';
            }
            return null;
        }

        // Beer selected
        if (orderState.beerVariety === 'Variado') {
            return `${orderState.beerType} (Variado)`;
        }
        return orderState.beerType;
    }

    return (
        <div className="sales-container-v2">

            {/* 1. Modo de Consumo */}
            <AccordionSection
                title="Modo de Consumo"
                isOpen={openSection === 'consumption'}
                onToggle={() => toggleSection('consumption')}
                selectionLabel={orderState.consumptionMode}
            >
                <div className="options-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <button
                        className={`option-btn ${orderState.consumptionMode === 'Local' ? 'selected' : ''}`}
                        onClick={() => handleConsumptionSelect('Local')}
                        style={{ height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <Store size={28} /> <span>Local</span>
                    </button>
                    <button
                        className={`option-btn ${orderState.consumptionMode === 'Para Llevar' ? 'selected' : ''}`}
                        onClick={() => handleConsumptionSelect('Para Llevar')}
                        style={{ height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <ShoppingBag size={28} /> <span>Para Llevar</span>
                    </button>
                </div>
            </AccordionSection>

            {/* 2. Forma de Emisión */}
            <AccordionSection
                title="Forma de Emisión"
                isOpen={openSection === 'emission'}
                onToggle={() => toggleSection('emission')}
                selectionLabel={orderState.emission ? `${orderState.emission} (${orderState.subtype})` : null}
                headerAction={
                    <div onClick={(e) => e.stopPropagation()}>
                        <ContainerSelector value={orderState.subtype} onChange={(val) => setOrderState(prev => ({ ...prev, subtype: val, emission: null }))} />
                    </div>
                }
            >
                <div className="options-grid">
                    {getEmissionsForSubtype(orderState.subtype).map(opt => (
                        <button
                            key={opt}
                            className={`option-btn ${orderState.emission === opt ? 'selected' : ''}`}
                            onClick={() => handleEmissionSelect(opt)}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </AccordionSection>

            {/* 3. Tipo de Cerveza */}
            <AccordionSection
                title="Tipo de Cerveza"
                isOpen={openSection === 'beer'}
                onToggle={() => toggleSection('beer')}
                selectionLabel={getBeerSelectionLabel()}
                headerAction={<VarietyToggle />}
            >

                {(orderState.beerVariety === 'Normal' || (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local')) ? (
                    <>
                        <div className="options-grid">
                            {beerTypes.map(opt => (
                                <button
                                    key={opt}
                                    className={`option-btn ${orderState.beerType === opt ? 'selected' : ''}`}
                                    onClick={() => handleBeerSelect(opt)}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                        {/* INSTRUCTIONAL MESSAGE FOR LOCAL VARIADO */}
                        {orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local' && (
                            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-card-hover)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <AlertCircle size={18} style={{ flexShrink: 0, color: 'var(--accent-color)' }} />
                                <span>Selecciona la primera cerveza. Las demás se agregarán en Pendientes.</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                        {orderState.consumptionMode === 'Para Llevar' && (
                            <>
                                <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                    Arma tu caja variada ahora.
                                </p>
                                <button
                                    className="create-ticket-btn"
                                    style={{ background: 'var(--accent-color)' }}
                                    onClick={() => setShowMixedBuilder(true)}
                                    disabled={!orderState.emission}
                                >
                                    {orderState.emission ? `Armar ${orderState.emission} Variada` : 'Selecciona Emisión Primero'}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </AccordionSection>

            {/* --- MIXED BUILDER MODAL --- */}
            {showMixedBuilder && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px', width: '95%' }}>
                        <h3 className="modal-title">Armar {orderState.emission}</h3>

                        {/* Progress Bar */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 600 }}>
                                <span>Progreso</span>
                                <span>{getMixedTotalUnits()} / {getTargetUnits()}</span>
                            </div>
                            <div style={{ width: '100%', height: '10px', background: 'var(--bg-card-hover)', borderRadius: '5px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${Math.min(100, (getMixedTotalUnits() / getTargetUnits()) * 100)}%`,
                                    height: '100%',
                                    background: getMixedTotalUnits() === getTargetUnits() ? '#34c759' : 'var(--accent-color)',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>

                        {/* Beer Grid */}
                        <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                            {beerTypes.map(beer => {
                                const count = mixedComposition[beer] || 0;
                                const stock = getInventory(beer, orderState.subtype);
                                const isMaxed = getMixedTotalUnits() >= getTargetUnits();

                                return (
                                    <div key={beer} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid var(--accent-light)' }}>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{beer}</div>
                                            <div style={{ fontSize: '0.75rem', color: stock < 10 ? '#ef4444' : 'var(--text-secondary)' }}>Disp: {stock}</div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                onClick={() => removeFromMix(beer)}
                                                disabled={count === 0}
                                                style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--accent-light)', background: 'transparent', color: 'var(--text-primary)' }}
                                            >
                                                -
                                            </button>
                                            <span style={{ fontWeight: 700, width: '24px', textAlign: 'center' }}>{count}</span>
                                            <button
                                                onClick={() => addToMix(beer)}
                                                disabled={isMaxed || stock <= 0}
                                                style={{ width: '32px', height: '32px', borderRadius: '50%', background: (isMaxed || stock <= 0) ? 'var(--bg-card-hover)' : 'var(--accent-color)', color: 'white', border: 'none' }}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Live Price Preview */}
                        <div style={{ textAlign: 'right', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Precio Estimado: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatCurrency(getMixedBsPrice(orderState.consumptionMode === 'Local' ? 'local' : 'standard'))} Bs</span>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="modal-close-btn" onClick={() => setShowMixedBuilder(false)} style={{ background: 'var(--bg-card-hover)', color: 'var(--text-primary)' }}>
                                Cancelar
                            </button>
                            <button
                                className="modal-close-btn"
                                onClick={confirmMixedCase}
                                disabled={getMixedTotalUnits() !== getTargetUnits()}
                                style={{ background: getMixedTotalUnits() === getTargetUnits() ? '#34c759' : '#ccc', color: 'white' }}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Summary / Cart Card */}
            <div className="order-summary-card">
                {/* Cart List */}
                {(cartItems.length > 0) && (
                    <div className="cart-list">
                        {cartItems.map((item) => (
                            <div key={item.id} className="cart-item-row">
                                <div style={{ flex: 1 }}>
                                    <span className="cart-item-info">
                                        <b>{item.quantity}x</b> {item.emission} {item.beerVariety === 'Variado' ? 'Variada' : item.beerType}
                                        <span style={{ fontSize: '0.8rem', color: item.consumptionMode === 'Local' ? '#FF9C57' : '#999', marginLeft: '6px', fontWeight: 500 }}>
                                            ({item.consumptionMode === 'Local' ? 'Local' : 'Llevar'})
                                        </span>
                                    </span>
                                    {/* Show composition details if varied */}
                                    {item.beerVariety === 'Variado' && item.composition && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
                                            {Object.entries(item.composition).map(([b, q]) => `${q} ${b}`).join(', ')}
                                        </div>
                                    )}
                                    {item.beerVariety === 'Variado' && !item.composition && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '1rem', fontStyle: 'italic' }}>
                                            * Base: {item.displayBase || item.baseBeer} ({item.subtype})
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600 }}>
                                        {item.beerVariety === 'Variado'
                                            ? formatCurrency(item.unitPriceBs * item.quantity)
                                            : formatCurrency(getBsPrice(item.beerType, item.emission, item.subtype, item.consumptionMode === 'Local' ? 'local' : 'standard') * item.quantity)
                                        } Bs
                                    </span>
                                    {!ticketStep && (
                                        <button className="cart-delete-btn" onClick={() => handleRemoveFromCart(item.id)}>
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Current Active Selection (Only showed if NOT Variado, or if builder not open) */}
                {isSelectionComplete() && ticketStep === 0 && (orderState.beerVariety === 'Normal' || (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local')) && (
                    <div className="summary-row">
                        <div className="quantity-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button onClick={decreaseQuantity} className="qty-btn" style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--accent-light)', background: 'var(--bg-card)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                            <span className="summary-item"><b>{orderState.quantity}x</b></span>
                            <button onClick={increaseQuantity} className="qty-btn" style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--accent-light)', background: 'var(--bg-card)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                            <span className="summary-item" style={{ marginLeft: '8px' }}>
                                {getBeerSelectionLabel() || `${orderState.beerType} (${orderState.emission})`}
                            </span>
                        </div>
                        <span className="summary-price">
                            {formatCurrency(
                                (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local')
                                    ? getBsPrice(orderState.beerType, orderState.emission, orderState.subtype, 'local') * orderState.quantity
                                    : getBsPrice(orderState.beerType, orderState.emission, orderState.subtype, orderState.consumptionMode === 'Local' ? 'local' : 'standard') * orderState.quantity
                            )} Bs
                        </span>
                    </div>
                )}

                {isSelectionComplete() && ticketStep === 0 && (orderState.beerVariety === 'Normal' || (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local')) && (
                    <button className="add-item-btn" onClick={handleAddToCart}>
                        <PlusCircle size={18} /> Agregar otro producto
                    </button>
                )}


                {(cartItems.length > 0 || isSelectionComplete() || (orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local' && orderState.emission && orderState.beerType)) && (
                    <div className="summary-actions">
                        <button className="delete-action" onClick={handleClearBill}>
                            <Trash2 size={16} /> {ticketStep > 0 ? 'Cancelar Ticket' : 'Limpiar Todo'}
                        </button>
                    </div>
                )}

                <div className="summary-total-container" style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                    {orderState.consumptionMode === 'Local' && <span style={{ fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 600 }}>Precio Local</span>}
                    <div className="summary-total">{formatCurrency(currentTotal)} Bs</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, fontStyle: 'italic', marginTop: '-5px' }}>
                        {formatUsd(calculateTotalUsd())}
                    </div>
                </div>

                {/* Step 2: Payment */}
                {ticketStep === 2 && (
                    <div className="ticket-details-form">
                        <div className="ticket-info-row">
                            <span className="ticket-hash-display"># {ticketNumber}</span>
                            <span className="ticket-date">{ticketDate}</span>
                        </div>

                        {(cartItems.some(i => i.consumptionMode === 'Local') || (cartItems.some(i => i.beerVariety === 'Variado' && i.consumptionMode === 'Local'))) && (
                            <div className="input-group-large" style={{ marginBottom: '1rem' }}>
                                <User size={36} strokeWidth={2.5} className="input-icon-external" />
                                <input type="text" placeholder="Nombre del Cliente" className="ticket-input-large" value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoFocus />
                            </div>
                        )}

                        <h4 className="payment-section-title">Método de Pago</h4>

                        <div className="payment-methods-grid">
                            {paymentMethods.map(method => (
                                <button key={method} className={`option-btn ${paymentMethod === method ? 'selected' : ''}`} onClick={() => setPaymentMethod(method)} style={{ fontSize: '0.8rem', padding: '0.75rem 0.25rem' }}>{method}</button>
                            ))}
                        </div>

                        {paymentMethod === 'Pago Movil' && (
                            <div className="input-group-large">
                                <Hash size={36} strokeWidth={2.5} className="input-icon-external" />
                                <input type="text" placeholder="Referencia" className="ticket-input-large" value={paymentReference} onChange={(e) => { if (/^\d*$/.test(e.target.value)) setPaymentReference(e.target.value); }} inputMode="numeric" />
                            </div>
                        )}

                        {!paymentMethod && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
                                <AlertCircle size={18} />
                                <span>Selecciona un método de pago para continuar.</span>
                            </div>
                        )}
                    </div>
                )}

                {/* QUICK OPEN TAB (ONLY FOR LOCAL) */}
                {orderState.consumptionMode === 'Local' && !cartItems.length && !orderState.beerType && (
                    <div style={{ marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
                        <button
                            className="create-ticket-btn"
                            style={{
                                background: 'transparent',
                                border: '2px dashed var(--accent-light)',
                                color: 'var(--text-secondary)',
                                height: '60px'
                            }}
                            onClick={() => {
                                setTicketNumber(Math.floor(1000 + Math.random() * 9000));
                                setTicketStep(2); // Jump to name input
                            }}
                        >
                            <Store size={20} /> Solo Abrir Carta (Sin productos)
                        </button>
                    </div>
                )}

                <button
                    className={`create-ticket-btn ${ticketStep > 0 ? 'confirm-mode' : ''}`}
                    onClick={ticketStep === 0 ? handleInitialCreateClick : handleFinalConfirm}
                    disabled={
                        (ticketStep === 0 && !cartItems.length && !isSelectionComplete() && !(orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local' && orderState.emission && orderState.beerType)) ||
                        (ticketStep === 2 && !paymentMethod) // Explicitly disable if step 2 and no payment
                    }
                    style={{
                        opacity: (
                            (ticketStep === 0 && !cartItems.length && !isSelectionComplete() && !(orderState.beerVariety === 'Variado' && orderState.consumptionMode === 'Local' && orderState.emission && orderState.beerType)) ||
                            (ticketStep === 2 && !paymentMethod)
                        ) ? 0.5 : 1
                    }}
                >
                    {getButtonText()}
                </button>
            </div>

            {/* Success Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <CheckCircle className="modal-icon" size={64} color="#34c759" style={{ marginBottom: '1rem' }} />
                        <h3 className="modal-title">¡Venta Exitosa!</h3>
                        <button className="modal-close-btn" onClick={closeModal}>Cerrar y Nuevo Pedido</button>
                    </div>
                </div>
            )}

            {/* Stock Error Modal - THEMED WITH RED ICON */}
            {stockError && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ textAlign: 'center', maxWidth: '360px', borderRadius: '20px' }}>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                                <AlertCircle size={32} color="#ef4444" />
                            </div>
                            <h3 className="modal-title" style={{ color: '#ef4444', margin: 0, fontSize: '1.25rem' }}>Stock Insuficiente</h3>
                        </div>

                        <div style={{
                            background: 'var(--bg-card-hover)',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            marginBottom: '1.5rem',
                            textAlign: 'left',
                            border: '1px solid var(--accent-light)'
                        }}>
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, borderBottom: '1px solid var(--accent-light)', paddingBottom: '0.75rem', color: 'var(--text-primary)' }}>
                                {stockError.product}
                            </h4>

                            <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.95rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Requerido</span>
                                    <span style={{ fontWeight: 600 }}>{stockError.required} Uds</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Disponible</span>
                                    <span style={{ color: '#ef4444', fontWeight: 700 }}>{stockError.available} Uds</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--accent-light)', paddingTop: '0.75rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Faltante</span>
                                    <span style={{ fontWeight: 700 }}>{stockError.required - stockError.available} Uds</span>
                                </div>
                            </div>
                        </div>

                        <button className="modal-close-btn" onClick={() => setStockError(null)} style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: '12px', background: 'var(--bg-card-hover)', color: 'var(--text-primary)', border: 'none' }}>Entendido</button>
                    </div>
                </div>
            )}
            {showResetModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '320px', padding: '2rem' }}>
                        <h3 className="modal-title" style={{ marginBottom: '0.5rem' }}>¿Reiniciar Venta?</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Se perderá la selección actual.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <button
                                className="modal-close-btn"
                                onClick={confirmReset}
                                style={{ margin: 0, background: 'var(--bg-card-hover)', color: '#ef4444', border: '1px solid #ef4444' }}
                            >
                                Sí, Reiniciar
                            </button>
                            <button
                                className="create-ticket-btn"
                                onClick={() => setShowResetModal(false)}
                                style={{ margin: 0, fontSize: '1rem', padding: '0.75rem' }}
                            >
                                No, Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
