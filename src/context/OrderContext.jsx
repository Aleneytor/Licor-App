import React, { createContext, useContext, useState, useEffect } from 'react';
// import { supabase } from '../supabaseClient'; 
import { useAuth } from './AuthContext';
import { useProduct } from './ProductContext';
import { createSales } from '../services/api';

const OrderContext = createContext();

export const useOrder = () => useContext(OrderContext);

export const OrderProvider = ({ children }) => {
    const { user, organizationId } = useAuth();
    const { productMap } = useProduct();

    // Load from local storage
    const loadOrders = () => {
        try {
            const stored = localStorage.getItem('pendingOrders');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Error loading orders", e);
            return [];
        }
    };

    const [pendingOrders, setPendingOrders] = useState(loadOrders);

    // Persistence
    useEffect(() => {
        localStorage.setItem('pendingOrders', JSON.stringify(pendingOrders));
    }, [pendingOrders]);

    // --- Actions ---

    // Create a new Pending Ticket
    const createOrder = (customerName, items, type = 'Local') => {
        const newOrder = {
            id: Date.now().toString(), // Simple ID
            ticketNumber: Math.floor(1000 + Math.random() * 9000), // Random 4-digit
            customerName: customerName || 'Cliente',
            status: 'OPEN', // OPEN, PAID, CANCELLED
            type, // 'Local' usually
            createdAt: new Date().toISOString(),
            items: items.map(item => ({
                ...item,
                addedAt: new Date().toISOString()
            })),
            payments: []
        };

        setPendingOrders(prev => [newOrder, ...prev]);
        return newOrder;
    };

    // Add items to an existing Open Ticket
    const addItemToOrder = (orderId, item) => {
        setPendingOrders(prev => prev.map(order => {
            if (order.id === orderId) {
                return {
                    ...order,
                    items: [...order.items, { ...item, addedAt: new Date().toISOString() }]
                };
            }
            return order;
        }));
    };

    // Remove item from ticket (optional, good for corrections)
    const removeItemFromOrder = (orderId, itemId) => {
        setPendingOrders(prev => prev.map(order => {
            if (order.id === orderId) {
                return {
                    ...order,
                    items: order.items.filter(i => i.id !== itemId)
                };
            }
            return order;
        }));
    };

    // Close/Pay Order AND Record Sale in DB
    const closeOrder = async (orderId, paymentMethod, reference = '') => {
        // 1. Update Local State
        let orderToClose = null;

        setPendingOrders(prev => prev.map(order => {
            if (order.id === orderId) {
                orderToClose = order;
                return {
                    ...order,
                    status: 'PAID',
                    closedAt: new Date().toISOString(),
                    paymentMethod,
                    reference
                };
            }
            return order;
        }));

        // 2. Insert into Supabase 'sales' table
        if (orderToClose && organizationId && user) {
            try {
                // Prepare rows
                // Assuming 'items' has structure { name, subtype, emission, quantity, totalPrice? }
                // We need to map this carefully.
                // Assuming item.totalPrice is calculated or price * quantity.

                const salesRows = orderToClose.items.map(item => {
                    const productId = productMap?.[item.name] || null;
                    return {
                        organization_id: organizationId,
                        product_name_snapshot: item.name,
                        product_id: productId,
                        subtype: item.subtype || 'Botella',
                        emission: item.emission || 'Unidad',
                        quantity: item.quantity || 1, // Ensure quantity is tracked
                        // Calculate total price if not explicit? 
                        // Let's assume item.price is unit price? or item.total?
                        // Usually Ticket Items have 'price' (unit) and 'total'.
                        // Let's use item.price * item.quantity if total not present.
                        total_price: item.total || (item.price * (item.quantity || 1)),
                        payment_method: paymentMethod,
                        sold_by: user.id
                    };
                });

                if (salesRows.length > 0) {
                    const { error } = await createSales(salesRows);
                    if (error) console.error("Error recording sales to DB:", error);
                }
            } catch (err) {
                console.error("Error in closeOrder sync:", err);
            }
        }
    };

    // Delete/Cancel Order
    const cancelOrder = (orderId) => {
        setPendingOrders(prev => prev.filter(order => order.id !== orderId));
    };

    // --- Consumption Tracking ---

    // Helper to get unit count (Context usage issue: Need access to useProduct inside? 
    // No, OrderContext can't consume ProductContext easily if circular.
    // Better to pass 'slots' or 'totalUnits' when adding the item.
    // Let's modify Actions to accept initialized slots or do it in Component?
    // Doing it in Component is riskier for data integrity.
    // Let's rely on 'quantity' and simple multipliers if possible, or expect `item` to have `slots`.
    // Actually, simple solution: `createOrder` and `addItem` logic stays simple, 
    // BUT we add a check: if `item.emission` is Crate, we might not know unit count here easily.
    // Proposed Fix: The CALLER (SalesPage/PendingPage) should calculate total units and pass it?
    // OR: We initiate `slots` lazily in `updateOrderItemSlot`.

    const updateOrderItemSlot = (orderId, itemIndex, slotIndex, content) => {
        setPendingOrders(prev => prev.map(order => {
            if (order.id !== orderId) return order;

            const newItems = [...order.items];
            const item = newItems[itemIndex];

            // Initialize slots if missing
            // We need to valid unit count. Assuming the component rendered it correctly, 
            // the `slots` array length should match what the UI expects.
            // If it doesn't exist, we create it based on current known length logic 
            // OR we just assume the specific array index is valid (Javascript arrays are sparse).

            let newSlots = item.slots ? [...item.slots] : [];

            // Set content
            newSlots[slotIndex] = content;

            newItems[itemIndex] = { ...item, slots: newSlots };

            return { ...order, items: newItems };
        }));
    };

    return (
        <OrderContext.Provider value={{
            pendingOrders,
            createOrder,
            addItemToOrder,
            removeItemFromOrder,
            closeOrder,
            cancelOrder,
            updateOrderItemSlot // New Export
        }}>
            {children}
        </OrderContext.Provider>
    );
};
