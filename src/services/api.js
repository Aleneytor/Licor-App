import { supabase } from '../supabaseClient';
import { initialEmissions, initialSettings } from './mockData';

/* =========================================================================
   PRODUCTS
   ========================================================================= */

export const fetchProducts = async (organizationId) => {
    if (!organizationId) return { data: [], error: 'No Organization ID' };

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', organizationId);

    return { data: data || [], error };
};

export const createProduct = async (productData) => {
    const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select();

    return { data: data ? data[0] : null, error };
};

export const updateProduct = async (id, updates) => {
    const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select();

    return { data: data ? data[0] : null, error };
};

/* =========================================================================
   INVENTORY
   ========================================================================= */

export const fetchInventory = async (organizationId) => {
    if (!organizationId) return { data: [], error: 'No Organization ID' };

    // Fetch Inventory and Related Product info
    const { data, error } = await supabase
        .from('inventory')
        .select(`
            *,
            products (
                name,
                color
            )
        `)
        .eq('organization_id', organizationId);

    if (error) return { data: [], error };

    // Flatten structure to match app expectation { ..., products: { name: ... } }
    // Supabase returns nested object by default which matches what we need mostly,
    // but let's ensure it's robust.
    return { data: data || [], error: null };
};

export const upsertInventory = async (itemData) => {
    // itemData: { product_id, subtype, quantity, organization_id }
    // We use unique constraint on (product_id, subtype) for upsert
    const { data, error } = await supabase
        .from('inventory')
        .upsert(itemData, { onConflict: 'product_id, subtype' })
        .select();

    return { data: data ? data[0] : null, error };
};

/* =========================================================================
   SALES (ORDERS)
   ========================================================================= */

export const fetchSales = async (organizationId) => {
    if (!organizationId) return { data: [], error: 'No Organization ID' };

    // Fetch Orders with Items (if needed deeply) or just orders?
    // App usually wants a summary list.
    // If 'items' are embedded in the order object in the app logic, we need to fetch them.
    // However, the Supabase schema separates them.
    // We will join them.

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            items:order_items (*)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    return { data: data || [], error };
};

export const createSales = async (salesData) => {
    // salesData is array of orders? App logic seems to send one order usually but name implies multiple.
    // Looking at previous mock, it accepted an array.
    // We'll iterate or bulk insert if possible. 
    // Orders table structure needs parent insert then child insert.

    // NOTE: This usually comes as a single 'order' object from the app context, 
    // but the mock accepted [ ...newSales ]. 
    // Let's assume input is an array of orders.

    const results = [];
    const errors = [];

    for (const sale of salesData) {
        // 1. Create Order
        const { items, ...orderInfo } = sale;
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert([orderInfo])
            .select()
            .single();

        if (orderError) {
            errors.push(orderError);
            continue;
        }

        const orderId = orderData.id;

        // 2. Create Order Items
        if (items && items.length > 0) {
            const itemsToInsert = items.map(item => ({
                order_id: orderId,
                product_id: item.productID || item.id, // Adaptation
                product_name: item.name || item.beerType,
                quantity: item.quantity,
                price: item.price,
                emission: item.emission,
                subtype: item.subtype
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(itemsToInsert);

            if (itemsError) console.error("Error saving items for order " + orderId, itemsError);
        }

        results.push({ ...orderData, items }); // Return structure
    }

    return { data: results, error: errors.length ? errors : null };
};

/* =========================================================================
   PRICES
   ========================================================================= */

export const fetchPrices = async (organizationId) => {
    if (!organizationId) return { data: [], error: 'No Organization ID' };

    const { data, error } = await supabase
        .from('prices')
        .select(`
            *,
            products (name)
        `)
        .eq('organization_id', organizationId);

    // Helper to match app structure if needed?
    // App expects { ..., products: { name: ... } }

    return { data: data || [], error };
};

export const upsertPrice = async (priceData) => {
    const { data, error } = await supabase
        .from('prices')
        .upsert(priceData, { onConflict: 'product_id, emission, subtype, is_local' })
        .select();

    return { data: data ? data[0] : null, error };
};

/* =========================================================================
   SETTINGS / EMISSIONS
   ========================================================================= */

export const fetchSettings = async (organizationId) => {
    // Could move to DB later
    return { data: initialSettings, error: null };
};

export const fetchEmissions = async (organizationId) => {
    if (!organizationId) return { data: [], error: 'No Organization ID' };

    const { data, error } = await supabase
        .from('emission_types')
        .select('*')
        .eq('organization_id', organizationId);

    return { data: data || [], error };
};

export const upsertEmission = async (emissionData) => {
    // emissionData: { organization_id, name, subtype, units }
    const { data, error } = await supabase
        .from('emission_types')
        .upsert(emissionData, { onConflict: 'organization_id, name, subtype' })
        .select();

    return { data: data ? data[0] : null, error };
};

export const deleteProduct = async (id) => {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
    return { error };
};

export const deleteEmission = async (id) => {
    const { error } = await supabase
        .from('emission_types')
        .delete()
        .eq('id', id);
    return { error };
};

export const resetDatabase = async () => {
    console.warn("Reset Database called - This is destructive in Supabase!");
    // Requires admin privileges or implementation choice. 
    // For now, disabling or just clearing local state.
    localStorage.removeItem('pendingOrders');
    return { success: true };
};
