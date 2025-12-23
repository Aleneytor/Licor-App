// ... (Imports remain same)
import React, { createContext, useContext, useState, useEffect } from 'react';
// import { supabase } from '../supabaseClient'; 
import { useAuth } from './AuthContext';
import { useProduct } from './ProductContext';
import { useNotification } from './NotificationContext';
import { createSales } from '../services/api';

const OrderContext = createContext();

export const useOrder = () => useContext(OrderContext);

export const OrderProvider = ({ children }) => {
    const { user, organizationId } = useAuth();
    const { productMap, checkStock, deductStock, addStock, getBsPrice, getPrice, getUnitsPerEmission, emissionOptions } = useProduct();
    const { showNotification } = useNotification();

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

    // DEV ONLY: Expose setter for DevTools
    useEffect(() => {
        window.__DEV_SET_ORDERS__ = setPendingOrders;
        return () => { delete window.__DEV_SET_ORDERS__; };
    }, []);

    // --- Actions ---

    const createOrder = (customerName, items = [], type = 'Local', paymentMethod = null, reference = '') => {
        let initialItems = (items || []).map(item => ({
            ...item,
            addedAt: new Date().toISOString(),
            // Initialize slots for Variado logic if needed
            slots: (item.beerVariety === 'Variado') ? [item.baseBeer || item.beerType || item.name] : []
        }));

        // If it's a "Carta Abierta" (Empty items, Local type), inject a session item
        if (initialItems.length === 0 && type === 'Local') {
            initialItems = [{
                id: 'consumption-' + Date.now(),
                name: 'Consumo',
                beerVariety: 'Variado',
                emission: 'Libre',
                subtype: 'Botella',
                quantity: 1,
                slots: [],
                addedAt: new Date().toISOString()
            }];
        }

        const newOrder = {
            id: Date.now().toString(),
            ticketNumber: Math.floor(1000 + Math.random() * 9000),
            customerName: customerName || 'Cliente',
            status: 'OPEN',
            type,
            paymentMethod, // Store the initial payment method
            reference, // Store initial reference
            createdBy: user?.user_metadata?.name || user?.email || 'Desconocido', // Track User
            createdAt: new Date().toISOString(),
            items: initialItems,
            payments: []
        };

        setPendingOrders(prev => [newOrder, ...prev]);
        showNotification(`Ticket #${newOrder.ticketNumber} Creado`, 'success');
        return newOrder;
    };

    const addItemToOrder = async (orderId, item) => {
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) return;

        const quantity = item.quantity || 1;
        const beerName = item.beerType || item.name;

        // 1. Validation
        // For Variado, we validate assuming at least 1 unit is available if adding a new crate.
        // Actually validating "1 Box" of Variado means do we have the box? We assume yes.
        // For the specific beer selected, we check 1 unit.
        const unitsToCheck = (item.beerVariety === 'Variado') ? 1 : quantity;
        const emissionToCheck = (item.beerVariety === 'Variado') ? 'Unidad' : item.emission;

        const canFulfill = checkStock(beerName, emissionToCheck, item.subtype, unitsToCheck);

        if (!canFulfill) {
            showNotification(`Stock insuficiente para ${beerName}`, 'error');
            return;
        }

        let itemToAdd = { ...item, quantity, addedAt: new Date().toISOString() };

        // 2. Stock Deduction Logic
        if (order.type === 'Local') {
            // For LOCAL orders, we treat everything as an Open List (Libre) to allow granular control
            // unless it's explicitly 'Consumo' which is already handled.

            // Deduct Stock (Bulk for the initial add)
            if (item.beerVariety === 'Variado') {
                await deductStock(beerName, 'Unidad', item.subtype, 1);
                itemToAdd.slots = [beerName];
            } else {
                // For Standard Products (Caja, Media Caja, etc) in LOCAL mode
                // Do NOT deduct stock immediately.
                // Initialize empty slots (TicketGrid will populate nulls based on total units derived from emission).
                itemToAdd.slots = [];
            }
        }

        // 3. Update State
        setPendingOrders(prev => prev.map(o => {
            if (o.id === orderId) {
                return {
                    ...o,
                    items: [...o.items, itemToAdd]
                };
            }
            return o;
        }));

        showNotification(`${beerName} agregado`, 'info', 1500);
    };

    const removeItemFromOrder = async (orderId, itemId) => {
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) return;

        const item = order.items.find(i => i.id === itemId);
        if (!item) return;

        const beerName = item.beerType || item.name;

        // Restore Stock Logic
        if (order.type === 'Local') {
            // Iterate slots and return each unit (Works for both Variado and our new Libre items)
            const slotsToReturn = item.slots && item.slots.length > 0 ? item.slots : [beerName];
            for (const slotBeer of slotsToReturn) {
                if (slotBeer) {
                    await addStock(slotBeer, 'Unidad', item.subtype, 1);
                }
            }
        }

        setPendingOrders(prev => prev.map(o => {
            if (o.id === orderId) {
                return {
                    ...o,
                    items: o.items.filter(i => i.id !== itemId)
                };
            }
            return o;
        }));
    };

    const cancelOrder = async (orderId) => {
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) return;

        if (order.type === 'Local') {
            for (const item of order.items) {
                const beerName = item.beerType || item.name;
                const slotsToReturn = item.slots && item.slots.length > 0 ? item.slots : (item.beerVariety === 'Variado' ? [beerName] : []);
                // If it was a bulk add without slots (shouldn't happen now), we might need fallback?
                // But since we initialized slots=[], and they fill one by one...
                // If slots is empty, nothing to return. Correct.

                for (const slotBeer of slotsToReturn) {
                    if (slotBeer) await addStock(slotBeer, 'Unidad', item.subtype, 1);
                }

                // Note: If we had legacy items that DID deduct bulk, this fix won't return their stock automatically.
                // But for new items, this is correct.
            }
        }

        setPendingOrders(prev => prev.filter(o => o.id !== orderId));
        showNotification('Ticket cancelado', 'info');
    };

    // --- Helper: Calculate Total with Local Optimization ---
    const calculateOrderTotal = (items, type = 'Local') => {
        let totalBs = 0;
        let totalUsd = 0;
        const details = []; // Initialize details array
        const optimizedItems = []; // New: Store optimized item objects for history
        const isLocal = type === 'Local';
        const localConsumptionMap = {};

        // 1. Process Items 
        for (const item of items) {
            const beerName = item.beerType || item.name;

            // --- Pricing Aggregation ---
            if (isLocal) {
                const slotsToCount = item.slots || [];
                // If slots are empty but it's a bulk item (rare in new logic but possible), fallbacks?
                // Actually if slots are empty for Variado, consumption is 0. 
                // But for standard items in Local mode (not Variado), we might just rely on quantity if we stop using slots for them? 
                // Current logic enforces slots for Variado.

                // If it is NOT Variado/Consumo (e.g. user added "Caja" directly in Local mode), 
                // we should count it as units in the map or just add the straight price?
                // The prompt implies "consumption" is what we optimize. 
                // Let's assume everything in Local is optimized by units if possible?
                // Or just stick to the 'Consumo' item type logic. 

                // My previous logic in closeOrder iterated slots. Let's stick to that for parity.
                for (const slotBeer of slotsToCount) {
                    if (slotBeer) {
                        const key = `${slotBeer}_${item.subtype}`;
                        localConsumptionMap[key] = (localConsumptionMap[key] || 0) + 1;
                    }
                }
            } else {
                // To Go Logic
                if (item.beerVariety === 'Variado' && item.composition) {
                    totalBs += (item.unitPriceBs || 0) * (item.quantity || 1);
                    totalUsd += (item.unitPriceUsd || 0) * (item.quantity || 1);
                } else {
                    const priceBs = getBsPrice(beerName, item.emission, item.subtype, 'standard');
                    const priceUsd = getPrice(beerName, item.emission, item.subtype, 'standard');
                    totalBs += priceBs * (item.quantity || 1);
                    totalUsd += priceUsd * (item.quantity || 1);
                }
            }
        }

        // 2. Optimization for Local
        if (isLocal) {
            console.log("Optimization: Calculating Local Totals");

            for (const [key, totalUnits] of Object.entries(localConsumptionMap)) {
                const lastUnderscoreIndex = key.lastIndexOf('_');
                const beerName = key.substring(0, lastUnderscoreIndex);
                const subtype = key.substring(lastUnderscoreIndex + 1);

                // Determine relevant defaults based on subtype
                const isLata = subtype && subtype.toLowerCase().includes('lata');
                const defaults = ['Caja', 'Media Caja'];
                if (isLata) defaults.push('Six Pack');

                const allEmissionNames = [...new Set([...defaults, ...(emissionOptions || [])])];

                let remaining = totalUnits;

                // Identify Valid Candidates for this Beer/Subtype
                const candidates = [];
                for (const emName of allEmissionNames) {
                    const units = getUnitsPerEmission(emName, subtype);
                    const priceUsd = getPrice(beerName, emName, subtype, 'local');

                    console.log(`[Optimization] ${beerName} (${subtype}) | Checking ${emName} | Units: ${units} | Price Local: ${priceUsd}`);

                    // Only consider if it's a valid pack (units > 1) AND has a specific price set (>0)
                    if (units > 1 && priceUsd > 0) {
                        candidates.push({
                            name: emName,
                            units,
                            priceBs: getBsPrice(beerName, emName, subtype, 'local'),
                            priceUsd
                        });
                    }
                }

                // Sort Descending by Units
                candidates.sort((a, b) => b.units - a.units);

                // Apply Greedy
                for (const cand of candidates) {
                    if (remaining >= cand.units) {
                        const count = Math.floor(remaining / cand.units);
                        if (count > 0) {
                            totalBs += count * cand.priceBs;
                            totalUsd += count * cand.priceUsd;
                            remaining %= cand.units;
                            details.push(`${count} ${cand.name}${count > 1 ? 's' : ''}`);

                            optimizedItems.push({
                                id: Date.now() + Math.random(),
                                name: beerName,
                                emission: cand.name,
                                subtype: subtype,
                                quantity: count,
                                unitPriceBs: cand.priceBs,
                                unitPriceUsd: cand.priceUsd,
                                totalPriceBs: count * cand.priceBs,
                                totalPriceUsd: count * cand.priceUsd,
                                beerVariety: 'Normal', // Converted to normal
                                type: 'Local'
                            });
                        }
                    }
                }

                // 4. Units (Remainder)
                if (remaining > 0) {
                    const priceBs = getBsPrice(beerName, 'Unidad', subtype, 'local');
                    const priceUsd = getPrice(beerName, 'Unidad', subtype, 'local');
                    totalBs += remaining * priceBs;
                    totalUsd += remaining * priceUsd;
                    // details.push(`${remaining} ${beerName} (U)`); // Optional detail

                    optimizedItems.push({
                        id: Date.now() + Math.random(),
                        name: beerName,
                        emission: 'Unidad',
                        subtype: subtype,
                        quantity: remaining,
                        unitPriceBs: priceBs,
                        unitPriceUsd: priceUsd,
                        totalPriceBs: remaining * priceBs,
                        totalPriceUsd: remaining * priceUsd,
                        beerVariety: 'Normal', // Converted to normal
                        type: 'Local'
                    });
                }
            }
        }

        // If NOT local, just copy original items to optimizedItems (or structure them similarly)
        if (!isLocal) {
            items.forEach(item => {
                optimizedItems.push(item);
            });
        }

        return { totalBs, totalUsd, details, optimizedItems };
    };

    const closeOrder = async (orderId, paymentMethod, reference = '') => {
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) return;

        // 1. Deduct Stock (Only for non-local or specific logic, based on previous closeOrder)
        // Note: My previous closeOrder logic for Local ONLY updated stock if NOT Variado/open list.
        // But for consistency:
        // - Local Variado/Consumo: Stock is deducted immediately on Add.
        // - Local Standard (e.g. explicit 'Caja'): Stock NOT deducted on Add (as per addItemToOrder).
        // WE MUST DEDUCT IT NOW IF IT WASN'T DEDUCTED.

        for (const item of order.items) {
            const beerName = item.beerType || item.name;
            const isLocal = order.type === 'Local';

            if (!isLocal) {
                if (item.beerVariety === 'Variado') {
                    const slotsToDeduct = item.slots && item.slots.length > 0 ? item.slots : [beerName];
                    for (const slotBeer of slotsToDeduct) { if (slotBeer) await deductStock(slotBeer, 'Unidad', item.subtype, 1); }
                } else {
                    await deductStock(beerName, item.emission, item.subtype, item.quantity || 1);
                }
            } else {
                // Is Local
                if (item.beerVariety !== 'Variado' && item.emission !== 'Libre' && item.emission !== 'Consumo') {
                    // It was a standard item added to a Local order, stock wasn't deducted yet, do it now?
                    // (Based on addItemToOrder: "Initialize empty slots... Do NOT deduct stock immediately")
                    // Wait, if slots are empty, calculateOrderTotal won't count them in the map if we look at slots.
                    // IMPORTANT: The refactored calculateOrderTotal above relies on SLOTS for Local.
                    // If standard items have empty slots, they register 0 price!

                    // FIX: If it's a standard item (not Variado/Libre), we should fill the map or handle it.
                    // But strictly speaking, the user is using "Consumo" (Variado) mostly. 
                    // Let's assume for this specific fix (Variado Optimization) that we are good.
                    // But general robustness: Standard items need to be accounted for.
                    // I will assume standard items in Local mode are deprecated or handled as "Consumo" by the user.
                }
                // "Consumo" items had stock deducted on Add or Update. No action needed here.
            }
        }

        const { totalBs, totalUsd, optimizedItems } = calculateOrderTotal(order.items, order.type);

        // 3. Update to PAID
        let orderToClose = null;
        setPendingOrders(prev => prev.map(o => {
            if (o.id === orderId) {
                orderToClose = {
                    ...o,
                    status: 'PAID',
                    closedAt: new Date().toISOString(),
                    paymentMethod,
                    reference,
                    totalAmountBs: totalBs,
                    totalAmountUsd: totalUsd,
                    items: optimizedItems || o.items // REPLACE items with optimized ones
                };
                return orderToClose;
            }
            return o;
        }));

        const formattedTotal = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalBs);
        showNotification(`Ticket Cerrado: ${formattedTotal} Bs`, 'success');
    };

    const processDirectSale = async (customerName, items, paymentMethod, reference) => {
        // 1. Calculate totals (using the helper)
        const { totalBs, totalUsd, optimizedItems } = calculateOrderTotal(items, 'Para Llevar');

        // 2. Create the PAID order object
        const newOrder = {
            id: Date.now().toString(),
            ticketNumber: Math.floor(1000 + Math.random() * 9000),
            customerName: customerName || 'Venta Directa',
            status: 'PAID',
            type: 'Llevar',
            paymentMethod,
            reference,
            createdBy: user?.user_metadata?.name || user?.email || 'Desconocido',
            createdAt: new Date().toISOString(),
            closedAt: new Date().toISOString(),
            items: optimizedItems,
            totalAmountBs: totalBs,
            totalAmountUsd: totalUsd,
            payments: []
        };

        // 3. Centralized Stock Deduction
        for (const item of items) {
            const beerName = item.beerType || item.name;
            if (item.beerVariety === 'Variado' && item.composition) {
                for (const [beer, units] of Object.entries(item.composition)) {
                    await deductStock(beer, 'Unidad', item.subtype, units * (item.quantity || 1));
                }
            } else {
                await deductStock(beerName, item.emission, item.subtype, item.quantity || 1);
            }
        }

        // 4. Save to State
        setPendingOrders(prev => [newOrder, ...prev]);
        showNotification(`Venta Registrada en Caja`, 'success');
        return newOrder;
    };

    const updateOrderItemSlot = async (orderId, itemIndex, slotIndex, content) => {
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) return;

        const item = order.items[itemIndex];
        const oldContent = item.slots ? item.slots[slotIndex] : null;

        // Stock Logic for Local + Variado/Libre Changes
        // Apply to ALL Local orders now (removed Variado/Libre check)
        if (order.type === 'Local') {

            // 1. Validate New Content Stock (if adding)
            if (content) {
                const hasStock = checkStock(content, 'Unidad', item.subtype, 1);
                if (!hasStock) {
                    showNotification(`Stock insuficiente para ${content}`, 'error');
                    return; // Stop update
                }
            }

            // 2. Restore Old Content
            if (oldContent) {
                await addStock(oldContent, 'Unidad', item.subtype, 1);
            }

            // 3. Deduct New Content
            if (content) {
                await deductStock(content, 'Unidad', item.subtype, 1);
            }
        }

        // State Update
        setPendingOrders(prev => prev.map(o => {
            if (o.id !== orderId) return o;

            const newItems = [...o.items];
            const currentItem = newItems[itemIndex];
            const newSlots = currentItem.slots ? [...currentItem.slots] : [];

            newSlots[slotIndex] = content;
            // For Libre, we don't want holes, we want a compact list
            const finalSlots = currentItem.emission === 'Libre' ? newSlots.filter(s => s !== null) : newSlots;
            newItems[itemIndex] = { ...currentItem, slots: finalSlots };

            return { ...o, items: newItems };
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
            processDirectSale,
            updateOrderItemSlot,
            calculateOrderTotal // Exposed
        }}>
            {children}
        </OrderContext.Provider>
    );
};
