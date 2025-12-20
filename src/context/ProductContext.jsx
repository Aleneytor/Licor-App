import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
// import { useRealtime } from '../hooks/useRealtime'; // REMOVED
import {
    fetchProducts, createProduct, updateProduct,
    fetchInventory, upsertInventory,
    fetchPrices, // upsertPrice removed from import if used locally or we implement helper
    fetchSettings, fetchEmissions, fetchSales
} from '../services/api';

const ProductContext = createContext();

export const useProduct = () => useContext(ProductContext);

export const ProductProvider = ({ children }) => {
    const { user, organizationId } = useAuth();

    // Helper to load from storage (Fallback)
    const loadFromStorage = (key, fallback) => {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : fallback;
        } catch (e) {
            console.error(`Error loading ${key}`, e);
            return fallback;
        }
    };

    // State Declarations
    const [beerTypes, setBeerTypes] = useState([]);
    const [beerColors, setBeerColors] = useState({});
    const [productMap, setProductMap] = useState({}); // Name -> ID

    // --- NUEVO: Estado para emisiones CRUD ---
    const [rawEmissions, setRawEmissions] = useState([]); // Objetos {id, name, units}
    const [emissionOptions, setEmissionOptions] = useState([]); // Solo Nombres (para compatibilidad UI)

    const [subtypes, setSubtypes] = useState([]);
    const [prices, setPrices] = useState({});
    const [conversions, setConversions] = useState({});
    const [inventory, setInventory] = useState({});

    // --- MOCK DATA SYNC ---
    useEffect(() => {
        if (!organizationId) return;

        const fetchInitialData = async () => {
            try {
                // 1. Products (Fetch Name, Color, ID)
                const { data: products } = await fetchProducts(organizationId);

                const currentProductMap = {}; // Name -> ID
                const currentIdMap = {};      // ID -> Name

                if (products) {
                    setBeerTypes(products.map(p => p.name));
                    const colors = {};
                    products.forEach(p => {
                        if (p.color) colors[p.name] = p.color;
                        currentProductMap[p.name] = p.id;
                        currentIdMap[p.id] = p.name;
                    });
                    setBeerColors(colors);
                    setProductMap(currentProductMap);
                }

                // 2. NUEVO: Cargar Emisiones desde mock
                const { data: emissionsData } = await fetchEmissions();

                if (emissionsData) {
                    setRawEmissions(emissionsData);
                    // Aseguramos que 'Unidad' esté al principio
                    const names = ['Unidad', ...emissionsData.map(e => e.name).filter(n => n !== 'Unidad')];
                    setEmissionOptions(names);
                } else {
                    setEmissionOptions(['Unidad', 'Caja']);
                }

                // Cargar Subtipos
                const { data: settings } = await fetchSettings(organizationId);
                if (settings) {
                    const subtypesSetting = settings.find(s => s.key === 'subtypes');
                    if (subtypesSetting) setSubtypes(subtypesSetting.value);
                    else setSubtypes(['Botella', 'Botella Tercio', 'Lata Pequeña', 'Lata Grande']);
                }

                // 3. Inventory (Uses product_id)
                const { data: inv } = await fetchInventory(organizationId);
                if (inv) {
                    const invMap = {};
                    inv.forEach(item => {
                        const productName = currentIdMap[item.product_id];
                        if (productName) {
                            invMap[`${productName}_${item.subtype}`] = item.quantity;
                        }
                    });
                    setInventory(invMap);
                }

                // 4. Prices
                const { data: pr } = await fetchPrices(organizationId);
                if (pr) {
                    const priceMap = {};
                    pr.forEach(p => {
                        const productName = currentIdMap[p.product_id];
                        if (productName) {
                            const suffix = p.is_local ? '_local' : '';
                            priceMap[`${productName}_${p.emission}_${p.subtype}${suffix}`] = Number(p.price);
                        }
                    });
                    setPrices(priceMap);
                }

                // 5. Conversions
                // Mock conversions from local storage for now if not in API
                const storedConversions = loadFromStorage('mock_conversions', []);
                if (storedConversions) {
                    const convMap = {};
                    storedConversions.forEach(c => {
                        convMap[`${c.emission}_${c.subtype}`] = c.units;
                    });
                    setConversions(convMap);
                }

            } catch (error) {
                console.error("Error fetching initial data:", error);
            }
        };

        fetchInitialData();
    }, [organizationId]);

    // --- REALTIME ALIGNMENT ---
    // Removed because Mock Data is local only. Refreshes will reload data.

    // --- PRODUCT MANAGEMENT ---
    const addBeerType = async (name, color) => {
        if (!organizationId) throw new Error("No estás conectado a una organización.");
        if (!beerTypes.includes(name)) {
            const { data, error } = await createProduct({ name, color, organization_id: organizationId });

            if (error) throw error;
            if (data) {
                setBeerTypes(prev => [...prev, name]);
                setProductMap(prev => ({ ...prev, [name]: data.id }));
                if (color) setBeerColors(prev => ({ ...prev, [name]: color }));
            }
        }
    };

    const updateBeerColor = async (name, color) => {
        setBeerColors(prev => ({ ...prev, [name]: color }));
        const productId = productMap[name];
        if (productId) {
            await updateProduct(productId, { color });
        }
    };

    const removeBeerType = async (name) => {
        // Not fully implemented in Mock API yet but UI expects it
        const productId = productMap[name];
        if (!productId) return;
        setBeerTypes(prev => prev.filter(b => b !== name));
        // await deleteProduct(productId); // Mock delete not impl
    };

    const getBeerColor = (beerName) => {
        const hex = beerColors[beerName];
        if (!hex) return { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB', raw: '#9CA3AF' };
        const r = parseInt(hex.substr(1, 2), 16);
        const g = parseInt(hex.substr(3, 2), 16);
        const b = parseInt(hex.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        const textColor = (yiq >= 128) ? '#1f2937' : '#ffffff';
        return { bg: hex, text: textColor, border: 'rgba(0,0,0,0.1)', raw: hex };
    };

    // --- 2. EMISSION TYPES ---
    const addEmissionType = async (name, units = 1) => {
        if (!emissionOptions.includes(name)) {
            try {
                // Mock insert
                const newEmission = { id: Date.now(), name, units: parseInt(units) };
                const updated = [...rawEmissions, newEmission];
                setRawEmissions(updated);
                setEmissionOptions(prev => [...prev, name]);
                localStorage.setItem('mock_emissions', JSON.stringify(updated));
                return { success: true };
            } catch (error) {
                console.error("Error creating emission:", error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: "Ya existe" };
    };

    const removeEmissionType = async (name) => {
        if (name === 'Caja' || name === 'Unidad') {
            alert('No se puede eliminar la emisión base.');
            return;
        }
        try {
            const updated = rawEmissions.filter(e => e.name !== name);
            setRawEmissions(updated);
            setEmissionOptions(prev => prev.filter(e => e !== name));
            localStorage.setItem('mock_emissions', JSON.stringify(updated));
        } catch (error) {
            console.error("Error removing emission:", error);
        }
    };

    // --- PRICES & CONVERSIONS ---
    const updatePrice = async (beer, emission, subtype, price, isLocal = false) => {
        const suffix = isLocal ? '_local' : '';
        const key = `${beer}_${emission}_${subtype}${suffix}`;
        const newPrice = parseFloat(price);
        setPrices(prev => ({ ...prev, [key]: newPrice }));

        const productId = productMap[beer];
        if (productId) {
            // Mock Upsert Price
            const prices = loadFromStorage('mock_prices', []);
            const existingIndex = prices.findIndex(p =>
                p.product_id === productId &&
                p.emission === emission &&
                p.subtype === subtype &&
                p.is_local === isLocal
            );

            const priceData = {
                organization_id: organizationId,
                product_id: productId,
                emission,
                subtype,
                price: newPrice,
                is_local: isLocal
            };

            if (existingIndex >= 0) {
                prices[existingIndex] = { ...prices[existingIndex], ...priceData };
            } else {
                prices.push({ ...priceData, id: Date.now().toString() });
            }
            localStorage.setItem('mock_prices', JSON.stringify(prices));
        }
    };

    const getPrice = (beer, emission, subtype, mode = 'standard') => {
        const suffix = mode === 'local' ? '_local' : '';
        const key = `${beer}_${emission}_${subtype}${suffix}`;
        return prices[key] || 0;
    };

    const updateConversion = async (emission, units, subtype) => {
        const key = `${emission}_${subtype}`;
        const newUnits = parseInt(units, 10);
        setConversions(prev => ({ ...prev, [key]: newUnits }));

        // Mock Upsert Conversion
        const conversions = loadFromStorage('mock_conversions', []);
        const existingIndex = conversions.findIndex(c =>
            c.emission === emission && c.subtype === subtype
        );
        const data = { organization_id: organizationId, emission, subtype, units: newUnits };

        if (existingIndex >= 0) {
            conversions[existingIndex] = { ...conversions[existingIndex], ...data };
        } else {
            conversions.push({ ...data, id: Date.now().toString() });
        }
        localStorage.setItem('mock_conversions', JSON.stringify(conversions));
    };

    const getUnitsPerEmission = (emission, subtype) => {
        if (!emission || emission === 'Unidad') return 1;
        if (emission === 'Libre') return 1;

        const conversionKey = `${emission}_${subtype}`;
        if (conversions[conversionKey]) return conversions[conversionKey];

        const dbEmission = rawEmissions.find(e => e.name === emission);
        if (dbEmission && dbEmission.units) return dbEmission.units;

        if (emission === 'Caja') {
            if (subtype && subtype.toLowerCase().includes('lata')) return 24;
            if (subtype && subtype.toLowerCase().includes('tercio')) return 36;
            return 12;
        }
        return 1;
    };

    // --- EXCHANGE RATES ---
    const [exchangeRates, setExchangeRates] = useState(() =>
        loadFromStorage('exchangeRates', { bcv: 0, parallel: 0, lastUpdate: null })
    );

    const fetchRates = async () => {
        try {
            const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
            const data = await response.json();
            if (data && data.promedio) {
                setExchangeRates({
                    bcv: data.promedio,
                    parallel: 0,
                    lastUpdate: new Date().toLocaleString()
                });
            }
        } catch (error) {
            console.error("Error fetching rates:", error);
        }
    };

    const getBsPrice = (beer, emission, subtype, mode = 'standard') => {
        const usd = getPrice(beer, emission, subtype, mode);
        return usd * (exchangeRates.bcv || 0);
    };

    // --- INVENTORY MANAGEMENT (CORREGIDO) ---

    const addStock = async (beer, emission, subtype, quantity) => {
        const units = quantity * getUnitsPerEmission(emission, subtype);
        const key = `${beer}_${subtype}`;

        const currentTotal = inventory[key] || 0;
        const newTotal = currentTotal + units;

        // 1. Actualizar UI
        setInventory(prev => ({ ...prev, [key]: newTotal }));

        // 2. Actualizar Mock BD
        const productId = productMap[beer];
        if (productId) {
            await upsertInventory({
                organization_id: organizationId,
                product_id: productId,
                subtype,
                quantity: newTotal
            });
        }
    };

    const deductStock = async (beer, emission, subtype, quantity) => {
        const units = quantity * getUnitsPerEmission(emission, subtype);
        const key = `${beer}_${subtype}`;

        const currentTotal = inventory[key] || 0;
        const newTotal = Math.max(0, currentTotal - units);

        setInventory(prev => ({ ...prev, [key]: newTotal }));

        const productId = productMap[beer];
        if (productId) {
            await upsertInventory({
                organization_id: organizationId,
                product_id: productId,
                subtype,
                quantity: newTotal
            });
        }
    };

    const setBaseStock = async (beer, subtype, units) => {
        const key = `${beer}_${subtype}`;

        setInventory(prev => ({ ...prev, [key]: units }));

        const productId = productMap[beer];
        if (productId) {
            await upsertInventory({
                organization_id: organizationId,
                product_id: productId,
                subtype,
                quantity: units
            });
        }
    };

    const checkStock = (beer, emission, subtype, quantity) => {
        const key = `${beer}_${subtype}`;
        const available = inventory[key] || 0;
        const required = quantity * getUnitsPerEmission(emission, subtype);
        return available >= required;
    };

    const getInventory = (beer, subtype) => {
        if (!beer || !subtype) return 0;
        const key = `${beer}_${subtype}`;
        return inventory[key] || 0;
    };

    // --- PENDING / SESSION INVENTORY ---
    const [pendingInventory, setPendingInventory] = useState({});
    const [inventoryHistory, setInventoryHistory] = useState(() => loadFromStorage('inventoryHistory', []));

    const updatePendingInventory = (beer, subtype, delta) => {
        const key = `${beer}_${subtype}`;
        setPendingInventory(prev => {
            const current = prev[key] || 0;
            const newVal = current + delta;
            if (newVal === 0) {
                const { [key]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [key]: newVal };
        });
    };

    const clearPendingInventory = () => setPendingInventory({});

    const commitInventory = async () => {
        const timestamp = new Date().toLocaleString('es-VE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        const movements = [];
        let totalCount = 0;

        // Procesar todos los cambios
        const promises = Object.entries(pendingInventory).map(async ([key, quantity]) => {
            const [beer, subtype] = key.split('_');
            await addStock(beer, 'Unidad', subtype, quantity); // Ahora espera a que termine addStock
            totalCount += quantity;
            movements.push({ beer, subtype, quantity });
        });

        await Promise.all(promises);

        const report = {
            id: Date.now(),
            timestamp,
            movements,
            totalUnits: totalCount
        };

        setInventoryHistory(prev => [report, ...prev].slice(0, 50));
        setPendingInventory({});
        return report;
    };

    const getPendingInventory = (beer, subtype) => {
        const key = `${beer}_${subtype}`;
        return pendingInventory[key] || 0;
    };

    useEffect(() => { localStorage.setItem('inventoryHistory', JSON.stringify(inventoryHistory)); }, [inventoryHistory]);
    useEffect(() => { localStorage.setItem('exchangeRates', JSON.stringify(exchangeRates)); }, [exchangeRates]);

    return (
        <ProductContext.Provider value={{
            beerTypes,
            addBeerType,
            removeBeerType,
            emissionOptions,
            addEmissionType,
            removeEmissionType,
            subtypes,
            conversions,
            updateConversion,
            prices,
            updatePrice,
            inventory,
            setBaseStock,
            addStock,
            deductStock,
            checkStock,
            getInventory,
            getPrice,
            getBsPrice,
            exchangeRates,
            fetchRates,
            getUnitsPerEmission,
            pendingInventory,
            updatePendingInventory,
            clearPendingInventory,
            commitInventory,
            getPendingInventory,
            inventoryHistory,
            getBeerColor,
            updateBeerColor,
            productMap
        }}>
            {children}
        </ProductContext.Provider>
    );
};

