// ... (Imports remain same)
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useProduct } from './ProductContext';
import { useNotification } from './NotificationContext';
import { fetchSales, createSales } from '../services/api';

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

    // --- Sync Sales History from Supabase ---
    useEffect(() => {
        if (organizationId) {
            const syncSales = async () => {
                try {
                    const { data, error } = await fetchSales(organizationId);
                    if (error) throw error;

                    if (data) {
                        setPendingOrders(prev => {
                            // Map of existing IDs (including the DB UUIDs and local IDs)
                            const existingIds = new Set(prev.map(o => o.id));

                            // Transform remote sales to match local order structure
                            const remoteSales = data.map(sale => ({
                                ...sale,
                                id: sale.id, // Keep the UUID
                                status: 'PAID',
                                items: sale.items || [],
                                totalAmountBs: sale.total_amount_bs || 0,
                                totalAmountUsd: sale.total_amount_usd || 0,
                                createdAt: sale.created_at,
                                closedAt: sale.closed_at || sale.created_at,
                                createdBy: sale.created_by || 'Desconocido'
                            })).filter(sale => !existingIds.has(sale.id));

                            if (remoteSales.length === 0) return prev;

                            // Merge and keep sorted (newest first)
                            const merged = [...prev, ...remoteSales].sort((a, b) =>
                                new Date(b.createdAt) - new Date(a.createdAt)
                            );

                            // Optional: Limit history to last 200 items to avoid bloated localStorage
                            return merged.slice(0, 200);
                        });
                    }
                } catch (err) {
                    console.error("Error syncing sales:", err);
                }
            };
            syncSales();
        }
    }, [organizationId]);

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

        // 1. Deduct Stock (Already analyzed in previous view, logic remains for parity)
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
                // Local mode stock logic (assumed handled or no-op as per previous analysis)
            }
        }

        const { totalBs, totalUsd, optimizedItems } = calculateOrderTotal(order.items, order.type);

        // 2. Prepare Order Object for DB & State
        const closedOrder = {
            ...order,
            status: 'PAID',
            closedAt: new Date().toISOString(),
            paymentMethod,
            reference,
            totalAmountBs: totalBs,
            totalAmountUsd: totalUsd,
            items: optimizedItems || order.items,
            organization_id: organizationId // Ensure Org ID is attached
        };

        // 3. Persist to Network (Supabase)
        try {
            await createSales([closedOrder]); // API expects array
        } catch (err) {
            console.error("Failed to save order to DB", err);
            // Optionally queue for retry?
        }

        // 4. Update State (Remove from pending)
        // Note: Logic allows keeping it in 'pendingOrders' with status PAID if that's the UI flow?
        // App seems to clear PAID orders from pending view usually? 
        // Existing logic updated it in place. Let's keep that but maybe user wants it cleared?
        // If it returns PAID, it might clutter pending list. Usually PAID goes to history.
        // I will keep existing behavior: Update to PAID in state.

        setPendingOrders(prev => prev.map(o => {
            if (o.id === orderId) {
                return closedOrder;
            }
            return o;
        }));

        const formattedTotal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalBs);
        showNotification(`Ticket Cerrado: ${formattedTotal} Bs`, 'success');
    };

    const processDirectSale = async (customerName, items, paymentMethod, reference) => {
        // 1. Calculate totals
        const { totalBs, totalUsd, optimizedItems } = calculateOrderTotal(items, 'Para Llevar');

        // 2. Create Order Object
        const newOrder = {
            id: Date.now().toString(), // Temp ID
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
            organization_id: organizationId,
            payments: []
        };

        // 3. Deduct Stock
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

        // 4. Persist to Network
        try {
            await createSales([newOrder]);
        } catch (err) {
            console.error("Failed to save direct sale to DB", err);
        }

        // 5. Update State
        // Add to pending? Or history? Existing logic added to pending.
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
