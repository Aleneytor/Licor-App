import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import { useProduct } from '../context/ProductContext';
import { useNotification } from '../context/NotificationContext';
import { Clock, Plus, Beer, MoreVertical, X, CheckCircle, ChevronDown, ChevronUp, Search, History, Store, User, Hash, AlertCircle } from 'lucide-react';
import TicketGrid from '../components/TicketGrid';
import ContainerSelector from '../components/ContainerSelector';
import './PendingPage.css'; // We will create this

export default function PendingPage() {
    const { pendingOrders, addItemToOrder, closeOrder, createOrder, calculateOrderTotal } = useOrder();
    const { getBsPrice, beerTypes, exchangeRates, getPrice, currencySymbol } = useProduct();
    const [selectedOrder, setSelectedOrder] = useState(null); // For "Add Item" modal
    const [closingOrderId, setClosingOrderId] = useState(null); // For "Confirm Close" modal
    const [newTabName, setNewTabName] = useState('');
    const [quickAddSubtype, setQuickAddSubtype] = useState('Botella');

    // Payment State for closing
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [paymentReference, setPaymentReference] = useState('');
    const paymentMethods = ['Efectivo', 'Pago Movil', 'Punto', 'BioPago'];

    const { showNotification } = useNotification(); // Already imported line 535, need to move it up or use existing
    // Check line 535 in view_file. No, wait. 
    // The previous view_file says `const { showNotification } = useNotification();` IS THERE but it seems to be in `PendingPage` which is correct, but let's check its scope. 
    // Wait, the previous view_file was SettingsPage.jsx (Step 406). 
    // PendingPage content (Step 419) doesn't show useNotification usage.
    // I need to add `const { showNotification } = useNotification();` to PendingPage component.

    // Step 419 shows line 12: `const [selectedOrder...]`
    // I need to update line 11-12.

    const handleQuickOpenTab = () => {
        if (!newTabName.trim()) {
            showNotification('Por favor, ingresa un nombre para la carta (ej: Mesa 5)', 'error');
            return;
        }
        createOrder(newTabName.trim(), [], 'Local');
        setNewTabName('');
        showNotification('Carta abierta exitosamente', 'success');
    };

    // Collapsible State (Store expanded IDs)
    // Default: All Expanded? Or Start Empty? 
    // Let's default to Empty or tracking clicks. 
    // User asked for "collapsable", usually implies initially closed or togglable.
    const [expandedOrders, setExpandedOrders] = useState({});

    const toggleOrder = (id) => {
        setExpandedOrders(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Filter OPEN orders
    const openOrders = pendingOrders.filter(o => o.status === 'OPEN');

    // 2. Filter by Search Term
    const filteredOrders = openOrders.filter(order => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase().trim();
        const name = order.customerName.toLowerCase();
        const ticket = order.ticketNumber.toString();

        return (
            name.includes(term) ||
            (name.length > 1 && term.includes(name)) ||
            ticket.includes(term)
        );
    });

    // 3. Split by Date (Today vs Previous)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysOrders = [];
    const previousOrders = [];

    filteredOrders.forEach(order => {
        // Ensure creation time exists, fallback to now if broken data
        const orderDate = new Date(order.createdAt || Date.now());
        orderDate.setHours(0, 0, 0, 0);

        if (orderDate.getTime() === today.getTime()) {
            todaysOrders.push(order);
        } else {
            previousOrders.push(order);
        }
    });

    const getOrderTotal = (items, type) => {
        // Use the centralized logic from OrderContext (returns { totalBs, totalUsd })
        const { totalUsd } = calculateOrderTotal(items, type);
        return totalUsd;
    }

    // LIST RENDERER
    const renderOrderList = (orders) => (
        orders.map(order => {
            const isOpenTab = order.items.some(i => i.emission === 'Libre');

            return (
                <div key={order.id} className="order-card">
                    <div
                        className="order-header"
                        onClick={() => toggleOrder(order.id)}
                    >
                        <div className="order-title-group">
                            <div className="collapse-icon">
                                {expandedOrders[order.id] ? <ChevronUp size={20} className="text-secondary" /> : <ChevronDown size={20} className="text-secondary" />}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 className="customer-name">{order.customerName}</h3>
                                    {isOpenTab && (
                                        <span style={{
                                            background: 'linear-gradient(90deg, #FF9C57 0%, #E65900 100%)',
                                            padding: '2px 8px',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            color: 'white',
                                            fontWeight: '700'
                                        }}>
                                            Carta Abierta
                                        </span>
                                    )}
                                </div>
                                <span className="ticket-number">#{order.ticketNumber}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                            <span style={{
                                color: 'white',
                                fontSize: '0.75rem',
                                fontFamily: 'Poppins, sans-serif',
                                fontWeight: 600
                            }}>
                                {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                            <span style={{
                                color: 'white',
                                fontSize: '0.7rem',
                                fontFamily: 'Poppins, sans-serif',
                                fontWeight: 400,
                                marginTop: '2px'
                            }}>
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>

                    {expandedOrders[order.id] && (
                        <>
                            <div className="order-items-list">
                                {order.items.length > 0 ? (
                                    order.items.map((item, idx) => (
                                        <div key={idx}>
                                            <TicketGrid
                                                orderId={order.id}
                                                item={item}
                                                itemIndex={idx}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <div style={{
                                        padding: '2rem 1rem',
                                        textAlign: 'center',
                                        color: 'var(--text-secondary)',
                                        background: 'var(--bg-app)',
                                        borderRadius: '12px',
                                        border: '1px dashed var(--accent-light)',
                                        marginBottom: '1rem'
                                    }}>
                                        <Beer size={32} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                                        <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Carta abierta sin productos</p>
                                        <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>Usa "Añadir Producto" para comenzar</p>
                                    </div>
                                )}
                            </div>

                            <div className="order-footer">
                                <div className="total-row">
                                    <span className="label">Total Estimado</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {(() => {
                                            const { totalUsd, details } = calculateOrderTotal(order.items, order.type);
                                            return (
                                                <>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        {(details || []).map((d, i) => (
                                                            <span key={i} style={{
                                                                background: 'rgba(52, 199, 89, 0.15)',
                                                                color: '#34c759',
                                                                fontSize: '0.7rem',
                                                                padding: '2px 6px',
                                                                borderRadius: '6px',
                                                                fontWeight: 600
                                                            }}>
                                                                {d}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <span className="amount">{currencySymbol}{totalUsd.toFixed(2)}</span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="actions-row" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem' }}>
                                    <button className="action-btn close-ticket-btn" onClick={() => setClosingOrderId(order.id)} style={{ flex: 1 }}>
                                        Cerrar Ticket
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            );
        })
    );

    const [showWasteModal, setShowWasteModal] = useState(false);
    const { reportWaste } = useProduct(); // Destructure reportWaste
    const [wasteSelection, setWasteSelection] = useState({ beer: '', quantity: 1 });

    const handleReportWaste = async () => {
        if (!wasteSelection.beer) return;
        await reportWaste(wasteSelection.beer, 'Botella', wasteSelection.quantity); // Default to Botella for now
        setShowWasteModal(false);
        setWasteSelection({ beer: '', quantity: 1 });
    };

    return (
        <div className="page-container">
            <header className="page-header" style={{ marginBottom: '1.5rem', display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="text-2xl font-bold text-primary">Cuentas Abiertas</h1>
                    <div className="header-badges" style={{ display: 'flex', gap: '8px' }}>
                        <span className="badge-active">{openOrders.length} Activas</span>

                        {/* WASTE BUTTON */}
                        <button
                            onClick={() => setShowWasteModal(true)}
                            style={{
                                background: '#FFF1F2',
                                color: '#BE123C',
                                border: '1px solid #FDA4AF',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <AlertCircle size={14} />
                            Reportar Merma
                        </button>
                    </div>
                </div>

                {/* NUEVO: Barra de Entrada Rápida para Carta Abierta */}
                <div style={{
                    background: 'var(--bg-card)',
                    padding: '1rem',
                    borderRadius: '16px',
                    border: '1px solid var(--accent-light)',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    gap: '0.75rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Plus size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-color)' }} />
                        <input
                            type="text"
                            placeholder="Nombre del cliente o Ref (ej: Juan - Barra)"
                            value={newTabName}
                            onChange={(e) => setNewTabName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleQuickOpenTab()}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 40px',
                                borderRadius: '12px',
                                border: '1px solid var(--accent-light)',
                                background: 'var(--bg-app)',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <button
                        onClick={handleQuickOpenTab}
                        // disabled={!newTabName.trim()} Remove disabled prop so we can show error
                        style={{
                            padding: '0 1.5rem',
                            borderRadius: '12px',
                            background: newTabName.trim() ? '#F97316' : 'var(--bg-card-hover)',
                            color: newTabName.trim() ? '#ffffff' : 'var(--text-secondary)',
                            border: 'none',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        Abrir Carta
                    </button>
                </div>

                {/* Search Bar */}
                <div className="search-bar-container" style={{ position: 'relative', width: '100%' }}>
                    <Search className="search-icon" size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente o número de ticket..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 40px',
                            borderRadius: '12px',
                            border: '1px solid var(--accent-light)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.95rem',
                            outline: 'none'
                        }}
                    />
                </div>
            </header>

            <div className="orders-content">
                {/* Today's Orders (Now First) */}
                {/* Today's Orders (Now First) */}
                {todaysOrders.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                        {/* Optional Header for Today if desired, or just list */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                            <Store size={20} className="text-success" />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Tickets Activos (Hoy)</h2>
                        </div>
                        <div className="orders-grid">
                            {renderOrderList(todaysOrders)}
                        </div>
                    </div>
                )}

                {/* Previous Orders Section (Now Last) */}
                {previousOrders.length > 0 && (
                    <div className="previous-orders-section" style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#F59E0B' }}>
                            <History size={20} />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Tickets Pendientes</h2>
                        </div>
                        <div className="orders-grid">
                            {renderOrderList(previousOrders)}
                        </div>
                        <hr style={{ margin: '2rem 0', borderColor: 'var(--accent-light)', opacity: 0.3 }} />
                    </div>
                )}

                {/* Empty State */}
                {todaysOrders.length === 0 && previousOrders.length === 0 && (
                    <div className="empty-state">
                        <Clock size={48} className="text-muted mb-4" />
                        <p className="text-secondary">
                            {searchTerm ? 'No se encontraron tickets' : 'No hay cuentas abiertas hoy'}
                        </p>
                    </div>
                )}
            </div>

            {/* Quick Add Modal */}
            {selectedOrder && (
                <div className="pending-modal-overlay">
                    <div className="pending-modal-content">
                        <div className="pending-modal-header">
                            <div>
                                <h3 className="pending-modal-title">Agregar Producto</h3>
                                <p className="pending-modal-subtitle">Cliente: {selectedOrder.customerName}</p>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedOrder(null)}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="quick-add-form">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h4 className="section-title">Selecciona Producto</h4>
                                <ContainerSelector value={quickAddSubtype} onChange={setQuickAddSubtype} />
                            </div>

                            <div className="selector-grid" style={{ maxHeight: '300px', overflowY: 'auto', padding: '4px' }}>
                                {beerTypes.map(beer => (
                                    <button
                                        key={beer}
                                        className="option-btn"
                                        style={{
                                            padding: '0.75rem',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                        onClick={() => {
                                            addItemToOrder(selectedOrder.id, {
                                                beerType: beer,
                                                subtype: quickAddSubtype,
                                                emission: 'Unidad', // Default to unit for quick add bar service
                                                quantity: 1,
                                                price: getPrice(beer, 'Unidad', quickAddSubtype, 'local'),
                                                consumptionMode: 'Local'
                                            });
                                            // Optional: Don't close modal to allow adding multiples
                                            // setSelectedOrder(null); 
                                        }}
                                    >
                                        <Beer size={18} />
                                        <span style={{ textAlign: 'center' }}>{beer}</span>
                                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                            {currencySymbol}{getPrice(beer, 'Unidad', quickAddSubtype, 'local').toFixed(2)}
                                        </span>
                                    </button>
                                ))
                                }</div>
                            <p className="modal-footer-text" style={{ marginTop: '1rem' }}>
                                Se agregará 1 unidad ({quickAddSubtype}) al ticket.
                                <br />Puedes seguir agregando o cerrar para terminar.
                            </p>
                            <button
                                className="action-btn"
                                style={{ width: '100%', marginTop: '1rem', background: 'var(--accent-color)', color: 'white' }}
                                onClick={() => setSelectedOrder(null)}
                            >
                                Terminar de Agregar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* WASTE REPORT MODAL */}
            {showWasteModal && (
                <div className="pending-modal-overlay">
                    <div className="pending-modal-content" style={{ maxWidth: '400px' }}>
                        <div className="pending-modal-header">
                            <div>
                                <h3 className="pending-modal-title" style={{ color: '#BE123C' }}>Reportar Merma</h3>
                                <p className="pending-modal-subtitle">Registra botellas rotas o daños</p>
                            </div>
                            <button className="close-btn" onClick={() => setShowWasteModal(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ padding: '0.5rem 0' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Cerveza Dañada
                            </label>
                            <div className="selector-grid" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                                {beerTypes.map(beer => (
                                    <button
                                        key={beer}
                                        className={`option-btn ${wasteSelection.beer === beer ? 'selected' : ''}`}
                                        onClick={() => setWasteSelection(prev => ({ ...prev, beer }))}
                                        style={{ padding: '0.75rem', fontSize: '0.9rem' }}
                                    >
                                        {beer}
                                    </button>
                                ))}
                            </div>

                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Cantidad (Unidades)
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setWasteSelection(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                                    style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--bg-app)', border: '1px solid var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <ChevronDown size={20} color="var(--text-primary)" />
                                </button>
                                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '40px', textAlign: 'center' }}>
                                    {wasteSelection.quantity}
                                </span>
                                <button
                                    onClick={() => setWasteSelection(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                                    style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--bg-app)', border: '1px solid var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <ChevronUp size={20} color="var(--text-primary)" />
                                </button>
                            </div>

                            <button
                                className="action-btn"
                                disabled={!wasteSelection.beer}
                                style={{
                                    width: '100%',
                                    background: !wasteSelection.beer ? 'var(--bg-card-hover)' : '#BE123C',
                                    color: 'white',
                                    opacity: !wasteSelection.beer ? 0.5 : 1
                                }}
                                onClick={handleReportWaste}
                            >
                                Confirmar Merma
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Close Modal */}
            {closingOrderId && (() => {
                const orderToClose = pendingOrders.find(o => o.id === closingOrderId);
                if (!orderToClose) return null;
                const totalUsd = getOrderTotal(orderToClose.items, orderToClose.type);
                const totalBs = totalUsd * (exchangeRates.bcv || 0);
                const isOpenTab = orderToClose.items.some(i => i.emission === 'Libre' || i.emission === 'Consumo');

                // If it's NOT an open tab, they already paid or pay elsewhere. 
                // Show simple confirm.
                if (!isOpenTab) {
                    return (
                        <div className="pending-modal-overlay">
                            <div className="pending-modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                                    <div style={{
                                        background: 'rgba(249, 115, 22, 0.1)',
                                        width: '72px',
                                        height: '72px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <CheckCircle size={32} style={{ color: '#F97316' }} />
                                    </div>
                                </div>
                                <h3 className="pending-modal-title" style={{ marginBottom: '0.5rem' }}>¿Finalizar Entrega?</h3>
                                <p className="pending-modal-subtitle" style={{ marginBottom: '1.5rem' }}>
                                    El cliente <b>{orderToClose.customerName}</b> ya ha pagado. Confirma que se ha entregado todo.
                                </p>
                                <div className="actions-row">
                                    <button
                                        className="action-btn"
                                        style={{ background: '#27272A', color: 'white', padding: '0.75rem', justifyContent: 'center' }}
                                        onClick={() => setClosingOrderId(null)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        className="action-btn close-ticket-btn"
                                        style={{ padding: '0.75rem', justifyContent: 'center', background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)', color: 'white' }}
                                        onClick={() => {
                                            closeOrder(closingOrderId, 'Pre-Pagado');
                                            setClosingOrderId(null);
                                        }}
                                    >
                                        Confirmar Entrega
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }

                // If OPEN TAB, show Payment Modal
                return (
                    <div className="pending-modal-overlay">
                        <div className="pending-modal-content" style={{ maxWidth: '450px' }}>
                            <div className="pending-modal-header">
                                <h3 className="pending-modal-title">Cerrar Ticket y Cobrar</h3>
                                <button className="close-btn" onClick={() => { setClosingOrderId(null); setPaymentMethod(null); setPaymentReference(''); }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div style={{ textAlign: 'center', marginBottom: '1.5rem', background: 'var(--bg-app)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--accent-light)' }}>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total a cobrar ({orderToClose.customerName})</p>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                                    ${totalUsd.toFixed(2)}
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent-color)', marginTop: '0.5rem' }}>
                                    {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Tasa BCV: {exchangeRates.bcv} Bs/$</p>
                            </div>

                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Selecciona Método de Pago</h4>
                            <div className="payment-methods-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                {paymentMethods.map(method => (
                                    <button
                                        key={method}
                                        className={`option-btn ${paymentMethod === method ? 'selected' : ''}`}
                                        onClick={() => setPaymentMethod(method)}
                                        style={{ padding: '0.75rem', fontSize: '0.85rem' }}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>

                            {paymentMethod === 'Pago Movil' && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Hash size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                        <input
                                            type="text"
                                            placeholder="Referencia"
                                            value={paymentReference}
                                            onChange={(e) => { if (/^\d*$/.test(e.target.value)) setPaymentReference(e.target.value); }}
                                            inputMode="numeric"
                                            style={{
                                                width: '100%',
                                                padding: '12px 12px 12px 40px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--accent-light)',
                                                background: 'var(--bg-app)',
                                                color: 'var(--text-primary)',
                                                fontSize: '1rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {!paymentMethod && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#F59E0B', marginBottom: '1.5rem', justifyContent: 'center' }}>
                                    <AlertCircle size={18} />
                                    <span>Selecciona un método para poder cobrar</span>
                                </div>
                            )}

                            <div className="actions-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <button
                                    className="action-btn"
                                    style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                                    onClick={() => { setClosingOrderId(null); setPaymentMethod(null); setPaymentReference(''); }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="action-btn close-ticket-btn"
                                    disabled={!paymentMethod || (paymentMethod === 'Pago Movil' && !paymentReference.trim())}
                                    style={{
                                        opacity: (!paymentMethod || (paymentMethod === 'Pago Movil' && !paymentReference.trim())) ? 0.5 : 1,
                                        background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                                        color: 'white'
                                    }}
                                    onClick={() => {
                                        closeOrder(closingOrderId, paymentMethod, paymentReference);
                                        setClosingOrderId(null);
                                        setPaymentMethod(null);
                                        setPaymentReference('');
                                    }}
                                >
                                    Cobrar y Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
