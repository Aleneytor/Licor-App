/**
 * MOCK API SERVICE
 * Replaces Supabase with localStorage
 */

import { initialProducts, initialEmissions, initialSettings } from './mockData';

const COLLECTION = {
    PRODUCTS: 'mock_products',
    INVENTORY: 'mock_inventory',
    SALES: 'mock_sales',
    PRICES: 'mock_prices',
    EMISSIONS: 'mock_emissions',
    SETTINGS: 'mock_settings',
    CONVERSIONS: 'mock_conversions'
};

// Helper: Simulate Async Delay
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Get from LocalStorage or Init
const getStore = (key, initial) => {
    try {
        const stored = localStorage.getItem(key);
        if (!stored) {
            if (initial) {
                localStorage.setItem(key, JSON.stringify(initial));
                return initial;
            }
            return [];
        }
        return JSON.parse(stored);
    } catch (e) {
        console.error(`Error loading ${key}`, e);
        return initial || [];
    }
};

const setStore = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
};

/* =========================================================================
   PRODUCTS
   ========================================================================= */

export const fetchProducts = async (organizationId) => {
    await delay();
    const products = getStore(COLLECTION.PRODUCTS, initialProducts);
    return { data: products, error: null };
};

export const createProduct = async (productData) => {
    await delay();
    const products = getStore(COLLECTION.PRODUCTS, initialProducts);
    const newProduct = { ...productData, id: Date.now().toString() };
    products.push(newProduct);
    setStore(COLLECTION.PRODUCTS, products);
    return { data: newProduct, error: null };
};

export const updateProduct = async (id, updates) => {
    await delay();
    const products = getStore(COLLECTION.PRODUCTS, initialProducts);
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return { data: null, error: { message: 'Not found' } };

    const updatedProduct = { ...products[index], ...updates };
    products[index] = updatedProduct;
    setStore(COLLECTION.PRODUCTS, products);
    return { data: updatedProduct, error: null };
};

/* =========================================================================
   INVENTORY
   ========================================================================= */

export const fetchInventory = async (organizationId) => {
    await delay();
    const inventory = getStore(COLLECTION.INVENTORY, []);
    const products = getStore(COLLECTION.PRODUCTS, initialProducts);

    // Join logic simulation
    const joined = inventory.map(item => {
        const prod = products.find(p => p.id === item.product_id);
        return {
            ...item,
            products: prod ? { name: prod.name, color: prod.color } : { name: 'Unknown', color: '#ccc' }
        };
    });

    return { data: joined, error: null };
};

export const upsertInventory = async (itemData) => {
    await delay(); // itemData has { product_id, subtype, quantity, organization_id }
    let inventory = getStore(COLLECTION.INVENTORY, []);

    const index = inventory.findIndex(i =>
        i.product_id === itemData.product_id &&
        i.subtype === itemData.subtype
    );

    let resultItem;
    if (index > -1) {
        inventory[index] = { ...inventory[index], ...itemData, updated_at: new Date().toISOString() };
        resultItem = inventory[index];
    } else {
        resultItem = { ...itemData, id: Date.now().toString(), updated_at: new Date().toISOString() };
        inventory.push(resultItem);
    }

    setStore(COLLECTION.INVENTORY, inventory);
    return { data: resultItem, error: null };
};

/* =========================================================================
   SALES
   ========================================================================= */

export const fetchSales = async (organizationId) => {
    await delay();
    const sales = getStore(COLLECTION.SALES, []);
    return { data: sales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), error: null };
};

export const createSales = async (salesData) => {
    await delay();
    let sales = getStore(COLLECTION.SALES, []);
    // Assign IDs and Dates
    const newSales = salesData.map(s => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString()
    }));

    sales = [...sales, ...newSales];
    setStore(COLLECTION.SALES, sales);
    return { data: newSales, error: null };
};

/* =========================================================================
   PRICES
   ========================================================================= */

export const fetchPrices = async (organizationId) => {
    await delay();
    const prices = getStore(COLLECTION.PRICES, []);
    const products = getStore(COLLECTION.PRODUCTS, initialProducts);

    const joined = prices.map(p => {
        const prod = products.find(prod => prod.id === p.product_id);
        return {
            ...p,
            products: prod ? { name: prod.name } : { name: 'Unknown' }
        };
    });

    return { data: joined, error: null };
};

export const upsertPrice = async (priceData) => {
    // This function wasn't explicitly exported in original api.js but logic was inside ProductContext.
    // We'll export a helper if needed, or context can use local storage directly?
    // Let's implement it to match api pattern.
    // NOTE: ProductContext calls `supabase.from('prices').upsert` directly. 
    // We will need to update ProductContext to call this API function instead or use this logic.
    // For now, I'll provide the implementation here to be called by context rewrites.
}

/* =========================================================================
   SETTINGS / EMISSIONS
   ========================================================================= */

export const fetchSettings = async (organizationId) => {
    await delay();
    return { data: getStore(COLLECTION.SETTINGS, initialSettings), error: null };
};

export const fetchEmissions = async () => {
    await delay();
    return { data: getStore(COLLECTION.EMISSIONS, initialEmissions), error: null };
};

export const resetDatabase = async () => {
    Object.values(COLLECTION).forEach(key => localStorage.removeItem(key));
    localStorage.removeItem('pendingOrders'); // Also clear pending orders from OrderContext
    // We could reload page here, but UI should handle it.
    return { success: true };
};
