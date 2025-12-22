import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
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
    const { showNotification } = useNotification();

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

    // --- MAIN CURRENCY ---
    const [mainCurrency, setMainCurrency] = useState(() => localStorage.getItem('mainCurrency') || 'USD');
    const currencySymbol = mainCurrency === 'USD' ? '$' : '€';

    // Persist Main Currency
    useEffect(() => {
        localStorage.setItem('mainCurrency', mainCurrency);
    }, [mainCurrency]);

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


    // --- DEV ONLY: Expose setters for DevTools ---
    useEffect(() => {
        window.__DEV_SET_INVENTORY__ = setInventory;
        window.__DEV_SET_INV_HISTORY__ = setInventoryHistory;
        window.__DEV_SET_WASTE_HISTORY__ = setBreakageHistory;
        return () => {
            delete window.__DEV_SET_INVENTORY__;
            delete window.__DEV_SET_INV_HISTORY__;
            delete window.__DEV_SET_WASTE_HISTORY__;
        };
    }, []);

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
        // TODO: Sync with DB (createProduct)
    };

    const updateBeerColor = async (name, color) => {
        setBeerColors(prev => ({ ...prev, [name]: color }));
        const productId = productMap[name];
        // if (productId) {
        //     await updateProduct(productId, { color });
        // }
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
    // --- 2. EMISSION TYPES ---
    const addEmissionType = async (name, units = 1, subtype = 'Botella') => {
        // Validation: Six Pack only for Latas
        if (name.toLowerCase().trim() === 'six pack' && !subtype.toLowerCase().includes('lata')) {
            return { success: false, error: "El Six Pack es exclusivo para Latas" };
        }

        // Allow same name for different subtypes (e.g. "Pack" for Bottle vs "Pack" for Can)
        // But check if it already exists for THIS subtype.
        const exists = rawEmissions.some(e => e.name === name && e.subtype === subtype);
        if (!exists) {
            try {
                // Mock insert
                const newEmission = { id: Date.now(), name, units: parseInt(units), subtype };
                const updated = [...rawEmissions, newEmission];
                setRawEmissions(updated);

                // Update simpler list unique names
                if (!emissionOptions.includes(name)) {
                    setEmissionOptions(prev => [...prev, name]);
                }

                localStorage.setItem('mock_emissions', JSON.stringify(updated));
                return { success: true };
            } catch (error) {
                console.error("Error creating emission:", error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: "Ya existe para este subtipo" };
    };

    const removeEmissionType = async (name, subtype) => {
        if (['Caja', 'Media Caja', 'Unidad'].includes(name)) {
            showNotification('No se puede eliminar la emisión base.', 'error');
            return;
        }
        try {
            // Remove specific emission for this subtype OR legacy global with same name
            const updated = rawEmissions.filter(e => !(e.name === name && (e.subtype === subtype || !e.subtype)));
            setRawEmissions(updated);

            // Should we remove from emissionOptions if no one else uses it?
            const stillUsed = updated.some(e => e.name === name);
            if (!stillUsed) {
                setEmissionOptions(prev => prev.filter(e => e !== name));
            }

            localStorage.setItem('mock_emissions', JSON.stringify(updated));
        } catch (error) {
            console.error("Error removing emission:", error);
        }
    };

    // NEW: Helper to get emissions relevant for a subtype (plus globals)
    const getEmissionsForSubtype = (subtype) => {
        const globals = ['Unidad', 'Media Caja', 'Caja'];
        const isLata = subtype && subtype.toLowerCase().includes('lata');

        // Auto-add Six Pack for any Lata
        if (isLata) {
            globals.push('Six Pack');
        }

        const custom = rawEmissions
            .filter(e => {
                const belongsToSubtype = e.subtype === subtype || !e.subtype;
                const isSixPack = e.name && e.name.toLowerCase().trim() === 'six pack';
                return belongsToSubtype && !isSixPack;
            })
            .map(e => e.name);

        const merged = Array.from(new Set([...globals, ...custom]));

        // Final sanity check: remove "Six Pack" if it's NOT a lata
        if (!isLata) {
            return merged.filter(n => n.toLowerCase().trim() !== 'six pack');
        }

        return merged;
    };

    // --- PRICES & CONVERSIONS ---
    const updatePrice = async (beer, emission, subtype, price, isLocal = false) => {
        const suffix = isLocal ? '_local' : '';
        const key = `${beer}_${emission}_${subtype}${suffix}`;
        const newPrice = parseFloat(price);
        setPrices(prev => ({ ...prev, [key]: newPrice }));

        // NOTIFICATION - Removed to use local Popup instead as requested
        // showNotification(`Precio actualizado: ${beer} (${emission}) - $${newPrice}`, 'success');

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

        let price = prices[key];

        // Fallback: If Local price is missing, try Standard
        if (mode === 'local' && (price === undefined || price === null)) {
            const standardKey = `${beer}_${emission}_${subtype}`;
            price = prices[standardKey];
        }

        return price || 0;
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
        if (emission === 'Six Pack') return 6;

        const conversionKey = `${emission}_${subtype}`;
        if (conversions[conversionKey]) return conversions[conversionKey];

        // Find specific emission for this subtype (Case Insensitive Subtype)
        const dbEmission = rawEmissions.find(e =>
            e.name === emission &&
            (e.subtype === subtype || (e.subtype && subtype && e.subtype.toLowerCase() === subtype.toLowerCase()))
        );
        if (dbEmission && dbEmission.units) return dbEmission.units;

        // Fallback to legacy (no subtype) or just name match if nothing else?
        // If I defined "Combo" for "Botella", and I ask for "Combo" for "Botella", it matches above.
        // What if I request "Combo" but the emission has no subtype defined (global)?
        const legacy = rawEmissions.find(e => e.name === emission && !e.subtype);
        if (legacy && legacy.units) return legacy.units;

        if (emission === 'Caja') {
            if (subtype && subtype.toLowerCase().includes('lata')) return 24;
            // Default to 36 (Tercio standard) for "Botella" as requested by user context
            return 36;
        }
        if (emission === 'Media Caja') {
            if (subtype && subtype.toLowerCase().includes('lata')) return 12;
            // Default to 18 (Half Tercio) for "Botella"
            return 18;
        }
        return 1;
    };

    // --- EXCHANGE RATES ---
    const [exchangeRates, setExchangeRates] = useState(() =>
        loadFromStorage('exchangeRates', { bcv: 0, parallel: 0, euro: 0, history: [], lastUpdate: null })
    );

    const fetchRates = async () => {
        try {
            // We keep using dolarapi for USD as per existing logic, and add dolarvzla for Euro & History
            const [bcvRes, parallelRes, euroRes, historyRes] = await Promise.allSettled([
                fetch('https://ve.dolarapi.com/v1/dolares/oficial'),
                fetch('https://ve.dolarapi.com/v1/dolares/paralelo'),
                fetch('https://api.dolarvzla.com/public/exchange-rate'),
                fetch('https://api.dolarvzla.com/public/exchange-rate/list')
            ]);

            let bcv = 0;
            let parallel = 0;
            let euro = 0;
            let history = [];
            let nextRates = null; // { date, usd, eur }

            // 1. Parallel (Keep DolarApi)
            if (parallelRes.status === 'fulfilled') {
                const data = await parallelRes.value.json();
                if (data && data.promedio) parallel = data.promedio;
            } else {
                console.error("Error fetching Parallel:", parallelRes.reason);
            }

            // 2. Official (BCV & Euro) from DolarVzla (Logic for Weekend/Future Rates)
            if (euroRes.status === 'fulfilled') {
                const data = await euroRes.value.json();
                // data: { current: { date: "2025-12-22", usd, eur }, previous: { date: "2025-12-19", usd, eur } }

                if (data?.current && data?.previous) {
                    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD Localish (UTC actually)
                    // Better to use user timezone or just compare simple strings if we trust the API date format.
                    // The API returns YYYY-MM-DD.
                    // Let's ensure we get the correct "today" for Venezuela/User.
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const localToday = `${year}-${month}-${day}`;

                    if (data.current.date > localToday) {
                        // Future Rate detected (e.g. It's Sunday, date is Monday)
                        // Use PREVIOUS as Effective
                        bcv = data.previous.usd;
                        euro = data.previous.eur;
                        nextRates = {
                            date: data.current.date,
                            usd: data.current.usd,
                            eur: data.current.eur
                        };
                    } else {
                        // Current is effective
                        bcv = data.current.usd;
                        euro = data.current.eur;
                    }
                } else if (data?.current) {
                    // Fallback if no previous
                    bcv = data.current.usd;
                    euro = data.current.eur;
                }

                // Fallback for BCV if DolarVzla fails but we have DolarApi result? 
                // We previously fetched BCV from DolarApi. 
                // Let's use DolarApi only if DolarVzla didn't give us a USD rate.
                if (!bcv && bcvRes.status === 'fulfilled') {
                    const bcvData = await bcvRes.value.json();
                    if (bcvData && bcvData.promedio) bcv = bcvData.promedio;
                }

            } else {
                console.error("Error fetching Official/Euro:", euroRes.reason);
                // Fallback BCV
                if (bcvRes.status === 'fulfilled') {
                    const bcvData = await bcvRes.value.json();
                    if (bcvData && bcvData.promedio) bcv = bcvData.promedio;
                }
            }

            if (historyRes.status === 'fulfilled') {
                const data = await historyRes.value.json();
                if (Array.isArray(data?.rates)) {
                    history = data.rates.slice(0, 7);
                }
            }

            setExchangeRates({
                bcv,
                parallel,
                euro,
                history,
                nextRates,
                lastUpdate: new Date().toLocaleString()
            });

        } catch (error) {
            console.error("Error fetching rates:", error);
        }
    };

    const getBsPrice = (beer, emission, subtype, mode = 'standard') => {
        const basePrice = getPrice(beer, emission, subtype, mode);
        const rate = mainCurrency === 'USD' ? (exchangeRates.bcv || 0) : (exchangeRates.euro || 0);
        return basePrice * rate;
    };

    // --- INVENTORY MANAGEMENT (CORREGIDO) ---

    const addStock = async (beer, emission, subtype, quantity) => {
        const units = quantity * getUnitsPerEmission(emission, subtype);
        const key = `${beer}_${subtype}`;

        const currentTotal = inventory[key] || 0;
        const newTotal = currentTotal + units;

        // 1. Actualizar UI
        setInventory(prev => ({ ...prev, [key]: newTotal }));

        // 2. Actualizar Mock BD / TODO: Sync with DB
        /*
        const productId = productMap[beer];
        if (productId) {
            await upsertInventory({
                organization_id: organizationId,
                product_id: productId,
                subtype,
                quantity: newTotal
            });
        }
        */
    };

    const deductStock = async (beer, emission, subtype, quantity) => {
        const units = quantity * getUnitsPerEmission(emission, subtype);
        const key = `${beer}_${subtype}`;

        const currentTotal = inventory[key] || 0;
        const newTotal = Math.max(0, currentTotal - units);

        setInventory(prev => ({ ...prev, [key]: newTotal }));

        // TODO: Sync with DB
        /*
        const productId = productMap[beer];
        if (productId) {
            await upsertInventory({
                organization_id: organizationId,
                product_id: productId,
                subtype,
                quantity: newTotal
            });
        }
        */
    };

    const setBaseStock = async (beer, subtype, units) => {
        const key = `${beer}_${subtype}`;

        setInventory(prev => ({ ...prev, [key]: units }));

        // TODO: Sync with DB
        /*
        const productId = productMap[beer];
        if (productId) {
            await upsertInventory({
                organization_id: organizationId,
                product_id: productId,
                subtype,
                quantity: units
            });
        }
        */
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

    const checkAggregateStock = (emission, subtype, requiredQuantity) => {
        // Calculate the TOTAL stock available across ALL beers for this subtype.
        const totalAvailable = beerTypes.reduce((acc, beer) => {
            const key = `${beer}_${subtype}`;
            return acc + (inventory[key] || 0);
        }, 0);

        const requiredUnits = requiredQuantity * getUnitsPerEmission(emission, subtype);
        return totalAvailable >= requiredUnits;
    };

    // --- PENDING / SESSION INVENTORY ---
    const [pendingInventory, setPendingInventory] = useState({});
    const [inventoryHistory, setInventoryHistory] = useState(() => loadFromStorage('inventoryHistory', []));

    // Updated: Key now includes emission to track separate inputs (e.g. "1 Caja" vs "12 Unidades")
    const updatePendingInventory = (beer, subtype, emission, delta) => {
        const key = `${beer}_${subtype}_${emission}`;
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

    const getPendingInventory = (beer, subtype, emission) => {
        const key = `${beer}_${subtype}_${emission}`;
        return pendingInventory[key] || 0;
    };

    const commitInventory = async () => {
        const timestamp = new Date().toLocaleString('es-VE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        const movements = [];
        let totalCount = 0;

        // Procesar todos los cambios
        const promises = Object.entries(pendingInventory).map(async ([key, quantity]) => {
            // Key format: Beer_Subtype_Emission
            // We need to be careful about splitting if names contain underscores, 
            // but our beer names/subtypes usually don't or we should handle it better.
            // For now assuming safe split or using last segment as emission.
            // Actually, safer to rely on known emissions or fix the key generation if names are complex.
            // Let's assume standard format for now.
            const parts = key.split('_');
            const emission = parts.pop(); // Last one is emission
            const subtype = parts.pop();  // Second to last is subtype
            const beer = parts.join('_'); // Rest is beer name (can contain underscores)

            const unitsPerEmission = getUnitsPerEmission(emission, subtype);
            const totalUnits = quantity * unitsPerEmission;

            await addStock(beer, 'Unidad', subtype, totalUnits);

            totalCount += totalUnits; // Count in UNITS
            movements.push({ beer, subtype, emission, quantity, totalUnits });
        });

        await Promise.all(promises);

        const report = {
            id: Date.now(),
            timestamp,
            movements, // Now contains 'quantity' (e.g. 1) and 'emission' (e.g. Caja)
            totalUnits: totalCount
        };

        setInventoryHistory(prev => [report, ...prev].slice(0, 50));
        setPendingInventory({});

        // NOTIFICATION
        showNotification(`${totalCount} Uds agregadas al inventario`, 'success');

        return report;
    };

    // --- WASTE / MERMA MANAGEMENT ---
    const [pendingWaste, setPendingWaste] = useState({});
    const [breakageHistory, setBreakageHistory] = useState(() => loadFromStorage('breakageHistory', []));

    const updatePendingWaste = (beer, subtype, emission, delta) => {
        const key = `${beer}_${subtype}_${emission}`;
        setPendingWaste(prev => {
            const current = prev[key] || 0;
            const newVal = Math.max(0, current + delta); // Wast cannot be negative
            if (newVal === 0) {
                const { [key]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [key]: newVal };
        });
    };

    const clearPendingWaste = () => setPendingWaste({});

    const commitWaste = async () => {
        // ... (Keep existing for backward compatibility if needed, or remove if unused)
        // For now, let's keep it but focusing on the new direct capability
        const timestamp = new Date().toLocaleString('es-VE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        const movements = [];
        let totalCount = 0;

        const promises = Object.entries(pendingWaste).map(async ([key, quantity]) => {
            const parts = key.split('_');
            const emission = parts.pop();
            const subtype = parts.pop();
            const beer = parts.join('_');

            const totalUnits = quantity * getUnitsPerEmission(emission, subtype);

            await deductStock(beer, emission, subtype, quantity);

            totalCount += totalUnits;
            movements.push({ beer, subtype, emission, quantity, totalUnits });
        });

        await Promise.all(promises);

        const report = {
            id: Date.now(),
            timestamp,
            movements,
            totalUnits: totalCount,
            type: 'WASTE'
        };

        setBreakageHistory(prev => [report, ...prev].slice(0, 50));
        setPendingWaste({});
        return report;
    };

    // NEW Direct Waste Reporting
    const reportWaste = async (beer, subtype, quantity) => {
        const timestamp = new Date().toLocaleString('es-VE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        const emission = 'Unidad'; // FORCE UNIT
        const totalUnits = parseInt(quantity, 10);

        // Deduct immediatly
        await deductStock(beer, emission, subtype, totalUnits);

        const report = {
            id: Date.now(),
            timestamp,
            movements: [{ beer, subtype, emission, quantity: totalUnits, totalUnits }],
            totalUnits: totalUnits, // Positive because it's a "Count of Waste"
            type: 'WASTE'
        };

        setBreakageHistory(prev => [report, ...prev].slice(0, 50));

        // NOTIFICATION
        showNotification(`Reportada Merma: ${quantity} ${beer}`, 'warning');

        return report;
    };

    const getPendingWaste = (beer, subtype, emission) => {
        const key = `${beer}_${subtype}_${emission}`;
        return pendingWaste[key] || 0;
    };

    useEffect(() => { localStorage.setItem('breakageHistory', JSON.stringify(breakageHistory)); }, [breakageHistory]);

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
            productMap,
            checkAggregateStock,
            getEmissionsForSubtype,
            // Waste Exports
            pendingWaste,
            updatePendingWaste,
            clearPendingWaste,
            commitWaste,
            reportWaste, // Exposed
            getPendingWaste,
            getPendingWaste,
            breakageHistory,
            // Currency Config
            mainCurrency,
            setMainCurrency,
            currencySymbol,
            resetApp: async () => {
                const { resetDatabase } = await import('../services/api');
                await resetDatabase();
                window.location.reload();
            }
        }}>
            {children}
        </ProductContext.Provider>
    );
};
