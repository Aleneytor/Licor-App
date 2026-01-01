import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
// import { useRealtime } from '../hooks/useRealtime'; // REMOVED
import { supabase } from '../supabaseClient';
import {
    fetchProducts, createProduct, updateProduct,
    fetchInventory, upsertInventory,
    fetchPrices, upsertPrice,
    fetchSettings, fetchEmissions, fetchSales, upsertEmission,
    deleteProduct, deleteEmission,
    fetchCostPrices, upsertCostPrice, upsertSetting,
    fetchInventoryHistory, createInventoryHistory,
    fetchWasteReports, createWasteReport,
    resetDatabase
} from '../services/api';

const ProductContext = createContext();

export const useProduct = () => useContext(ProductContext);

export const ProductProvider = ({ children }) => {
    const { user, organizationId } = useAuth();
    const { showNotification } = useNotification();

    // --- MAIN CURRENCY & STATE ---
    const [mainCurrency, setMainCurrency] = useState('USD');
    const [beerTypes, setBeerTypes] = useState([]);
    const [beerColors, setBeerColors] = useState({});
    const [productMap, setProductMap] = useState({});
    const [rawEmissions, setRawEmissions] = useState([]);
    const [emissionOptions, setEmissionOptions] = useState(['Unidad', 'Caja', 'Media Caja']);
    const [subtypes, setSubtypes] = useState(['Botella', 'Botella Tercio', 'Lata Pequeña', 'Lata Grande']);
    const [prices, setPrices] = useState({});
    const [inventory, setInventory] = useState({});
    const [conversions, setConversions] = useState({});
    const [exchangeRates, setExchangeRates] = useState({ bcv: 0, custom: 0, euro: 0, history: [], lastUpdate: null });
    const [costPrices, setCostPrices] = useState({});
    const [inventoryHistory, setInventoryHistory] = useState([]);
    const [breakageHistory, setBreakageHistory] = useState([]);
    const [pendingInventory, setPendingInventory] = useState({});
    const [pendingWaste, setPendingWaste] = useState({});

    const getCurrencySymbol = (mode) => {
        if (mode === 'USD') return '$';
        if (mode === 'EUR') return '€';
        if (mode === 'CUSTOM') return '$'; // Special symbol for custom rate
        return '$';
    };

    const currencySymbol = getCurrencySymbol(mainCurrency);

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

                // 2. Settings (Currency, Subtypes, Exchange Rates)
                const { data: settings } = await fetchSettings(organizationId);
                if (settings) {
                    const mainCurrencySetting = settings.find(s => s.key === 'mainCurrency');
                    if (mainCurrencySetting) setMainCurrency(mainCurrencySetting.value);

                    const exchangeRatesSetting = settings.find(s => s.key === 'exchangeRates');
                    if (exchangeRatesSetting) {
                        setExchangeRates(exchangeRatesSetting.value);
                    } else {
                        // Trigger initial fetch if none in DB
                        fetchRates();
                    }

                    const subtypesSetting = settings.find(s => s.key === 'subtypes');
                    if (subtypesSetting) setSubtypes(subtypesSetting.value);
                    else setSubtypes(['Botella', 'Botella Tercio', 'Lata Pequeña', 'Lata Grande']);
                } else {
                    fetchRates(); // Initial fetch
                }

                // 3. Emisiones
                const { data: emissionsData } = await fetchEmissions(organizationId);
                let emissionNames = ['Unidad', 'Caja'];
                if (emissionsData && emissionsData.length > 0) {
                    setRawEmissions(emissionsData);
                    emissionNames = ['Unidad', ...emissionsData.map(e => e.name).filter(n => n !== 'Unidad')];
                }
                setEmissionOptions(emissionNames);

                // 4. Inventory
                const { data: dbInv } = await fetchInventory(organizationId);
                const invMap = {};
                if (Array.isArray(dbInv)) {
                    dbInv.forEach(item => {
                        const productName = currentIdMap[item.product_id];
                        if (productName) {
                            invMap[`${productName}_${item.subtype}`] = item.quantity;
                        }
                    });
                }
                setInventory(invMap);

                // 5. Prices
                const { data: dbPrices } = await fetchPrices(organizationId);
                const priceMap = {};
                if (Array.isArray(dbPrices)) {
                    dbPrices.forEach(p => {
                        const productName = currentIdMap[p.product_id];
                        if (productName) {
                            const suffix = p.is_local ? '_local' : '';
                            priceMap[`${productName}_${p.p_emission || p.emission}_${p.subtype}${suffix}`] = Number(p.price);
                        }
                    });
                }
                setPrices(priceMap);

                // 6. Cost Prices
                const { data: dbCosts } = await fetchCostPrices(organizationId);
                const costMap = {};
                if (Array.isArray(dbCosts)) {
                    dbCosts.forEach(c => {
                        const productName = currentIdMap[c.product_id];
                        if (productName) {
                            costMap[`${productName}_${c.emission}_${c.subtype}`] = Number(c.cost);
                        }
                    });
                }
                setCostPrices(costMap);

                // 7. Conversions
                const convMap = {};
                if (emissionsData && Array.isArray(emissionsData)) {
                    emissionsData.forEach(e => {
                        if (e.name && e.subtype && e.units) {
                            convMap[`${e.name}_${e.subtype}`] = e.units;
                        }
                    });
                }
                setConversions(convMap);

                // 8. History (Inventory & Waste)
                const { data: invHist } = await fetchInventoryHistory(organizationId);
                const mappedInvHist = (invHist || []).map(h => ({
                    ...h,
                    type: 'INVENTORY',
                    timestamp: h.created_at ? new Date(h.created_at).toLocaleString() : '---'
                }));
                setInventoryHistory(mappedInvHist.slice(0, 50));

                const { data: wasteHist } = await fetchWasteReports(organizationId);
                const mappedWasteHist = (wasteHist || []).map(h => ({
                    ...h,
                    type: 'WASTE',
                    timestamp: h.created_at ? new Date(h.created_at).toLocaleString() : '---'
                }));
                setBreakageHistory(mappedWasteHist.slice(0, 50));

            } catch (error) {
                console.error("Error fetching initial data:", error);
            }
        };

        fetchInitialData();
    }, [organizationId]);


    // --- DEV ONLY: Expose setters for DevTools ---
    useEffect(() => {
        window.__DEV_SET_INVENTORY__ = setInventory;
        window.__DEV_SET_BEER_TYPES__ = setBeerTypes;
        window.__DEV_SET_BEER_COLORS__ = setBeerColors;
        window.__DEV_SET_RAW_EMISSIONS__ = setRawEmissions;
        window.__DEV_SET_EMISSION_OPTIONS__ = setEmissionOptions;
        window.__DEV_SET_SUBTYPES__ = setSubtypes;
        window.__DEV_SET_PRICES__ = setPrices;
        window.__DEV_SET_COST_PRICES__ = setCostPrices;
        window.__DEV_SET_INV_HISTORY__ = setInventoryHistory;
        window.__DEV_SET_WASTE_HISTORY__ = setBreakageHistory;
        return () => {
            delete window.__DEV_SET_INVENTORY__;
            delete window.__DEV_SET_BEER_TYPES__;
            delete window.__DEV_SET_BEER_COLORS__;
            delete window.__DEV_SET_RAW_EMISSIONS__;
            delete window.__DEV_SET_EMISSION_OPTIONS__;
            delete window.__DEV_SET_SUBTYPES__;
            delete window.__DEV_SET_PRICES__;
            delete window.__DEV_SET_COST_PRICES__;
            delete window.__DEV_SET_INV_HISTORY__;
            delete window.__DEV_SET_WASTE_HISTORY__;
        };
    }, []);

    // --- REALTIME SYNC (Active for Phone/PC Sync) ---
    useEffect(() => {
        if (!organizationId) return;

        // 1. Subscribe to Channels
        const channel = supabase
            .channel(`db-changes-${organizationId}`)
            // PRODUCTS
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `organization_id=eq.${organizationId}` }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setBeerTypes(prev => Array.from(new Set([...prev, payload.new.name])));
                    setProductMap(prev => ({ ...prev, [payload.new.name]: payload.new.id }));
                    if (payload.new.color) setBeerColors(prev => ({ ...prev, [payload.new.name]: payload.new.color }));
                } else if (payload.eventType === 'UPDATE') {
                    if (payload.new.color) setBeerColors(prev => ({ ...prev, [payload.new.name]: payload.new.color }));
                } else if (payload.eventType === 'DELETE') {
                    // Handle delete if needed
                }
            })
            // INVENTORY
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `organization_id=eq.${organizationId}` }, (payload) => {
                // We need to resolve product_id to name. Since we have productMap, we can attempt it,
                // but if productMap isn't updated, we might need a reverse map.
                // Let's use the current state to update.
                const findProductName = (id) => Object.keys(productMap).find(name => productMap[name] === id);

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const name = findProductName(payload.new.product_id);
                    if (name) {
                        setInventory(prev => ({ ...prev, [`${name}_${payload.new.subtype}`]: payload.new.quantity }));
                    }
                }
            })
            // PRICES
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prices', filter: `organization_id=eq.${organizationId}` }, (payload) => {
                const findProductName = (id) => Object.keys(productMap).find(name => productMap[name] === id);
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const name = findProductName(payload.new.product_id);
                    if (name) {
                        const suffix = payload.new.is_local ? '_local' : '';
                        const key = `${name}_${payload.new.emission}_${payload.new.subtype}${suffix}`;
                        setPrices(prev => ({ ...prev, [key]: Number(payload.new.price) }));
                    }
                }
            })
            // EMISSIONS (CONVERSIONS)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'emission_types', filter: `organization_id=eq.${organizationId}` }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const key = `${payload.new.name}_${payload.new.subtype}`;
                    setConversions(prev => ({ ...prev, [key]: payload.new.units }));
                    // Also update rawEmissions for the selector
                    setRawEmissions(prev => {
                        const idx = prev.findIndex(e => e.id === payload.new.id);
                        if (idx >= 0) {
                            const copy = [...prev];
                            copy[idx] = payload.new;
                            return copy;
                        }
                        return [...prev, payload.new];
                    });
                } else if (payload.eventType === 'DELETE') {
                    // Update rawEmissions
                    setRawEmissions(prev => prev.filter(e => e.id !== payload.old.id));
                }
            })
            // COST PRICES
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cost_prices', filter: `organization_id=eq.${organizationId}` }, (payload) => {
                const findProductName = (id) => Object.keys(productMap).find(name => productMap[name] === id);
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const name = findProductName(payload.new.product_id);
                    if (name) {
                        setCostPrices(prev => ({ ...prev, [`${name}_${payload.new.emission}_${payload.new.subtype}`]: Number(payload.new.cost) }));
                    }
                }
            })
            // ORGANIZATION SETTINGS
            .on('postgres_changes', { event: '*', schema: 'public', table: 'organization_settings', filter: `organization_id=eq.${organizationId}` }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    if (payload.new.key === 'mainCurrency') setMainCurrency(payload.new.value);
                    if (payload.new.key === 'exchangeRates') setExchangeRates(payload.new.value);
                    if (payload.new.key === 'subtypes') setSubtypes(payload.new.value);
                }
            })
            // INVENTORY HISTORY
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory_history', filter: `organization_id=eq.${organizationId}` }, (payload) => {
                const report = {
                    ...payload.new,
                    type: 'INVENTORY',
                    timestamp: new Date(payload.new.created_at).toLocaleString()
                };
                setInventoryHistory(prev => {
                    if (prev.some(h => h.id === report.id)) return prev;
                    return [report, ...prev].slice(0, 50);
                });
            })
            // WASTE REPORTS
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waste_reports', filter: `organization_id=eq.${organizationId}` }, (payload) => {
                const report = {
                    ...payload.new,
                    type: 'WASTE',
                    timestamp: new Date(payload.new.created_at).toLocaleString()
                };
                setBreakageHistory(prev => {
                    if (prev.some(h => h.id === report.id)) return prev;
                    return [report, ...prev].slice(0, 50);
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [organizationId, productMap]);

    // --- PRODUCT MANAGEMENT ---
    const addBeerType = async (name, color) => {
        if (!organizationId) throw new Error("No estás conectado a una organización.");
        if (!beerTypes.includes(name)) {
            console.log('[addBeerType] Creating product:', { name, color, organization_id: organizationId });

            const { data, error } = await createProduct({ name, color, organization_id: organizationId });

            if (error) {
                console.error('[addBeerType] Supabase Error:', error);
                throw new Error(error.message || 'Error al crear el producto en la base de datos');
            }

            if (data) {
                console.log('[addBeerType] Product created successfully:', data);
                setBeerTypes(prev => [...prev, name]);
                setProductMap(prev => ({ ...prev, [name]: data.id }));
                if (color) setBeerColors(prev => ({ ...prev, [name]: color }));
            } else {
                console.warn('[addBeerType] No data returned but no error either');
            }
        } else {
            console.log('[addBeerType] Product already exists:', name);
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
        const productId = productMap[name];
        if (!productId) return;

        // Optimistic UI update
        setBeerTypes(prev => prev.filter(b => b !== name));

        // Delete from DB
        try {
            await deleteProduct(productId);
        } catch (error) {
            console.error("Error deleting product from DB:", error);
            // Optional: Revert state if critical, but for now we log
        }
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
                // Real insert if connected
                if (organizationId) {
                    await upsertEmission({
                        organization_id: organizationId,
                        name,
                        units: parseInt(units),
                        subtype
                    });
                }

                const newEmission = { id: Date.now(), name, units: parseInt(units), subtype };
                const updated = [...rawEmissions, newEmission];
                setRawEmissions(updated);

                // Update simpler list unique names
                if (!emissionOptions.includes(name)) {
                    setEmissionOptions(prev => [...prev, name]);
                }

                // Sync with DB is priority
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
            // Find the item to delete (need its ID for DB deletion)
            const itemToDelete = rawEmissions.find(e => e.name === name && (e.subtype === subtype || (!e.subtype && !subtype)));

            // Remove specific emission for this subtype OR legacy global with same name
            const updated = rawEmissions.filter(e => !(e.name === name && (e.subtype === subtype || !e.subtype)));
            setRawEmissions(updated);

            // Should we remove from emissionOptions if no one else uses it?
            const stillUsed = updated.some(e => e.name === name);
            if (!stillUsed) {
                setEmissionOptions(prev => prev.filter(e => e !== name));
            }


            // Delete from DB
            if (itemToDelete && itemToDelete.id) {
                // Check if it's a temp ID (timestamp) or UUID. Usually UUID from Supabase.
                // Even if "mock" ID (Date.now()), we shouldn't error but it won't be in DB.
                await deleteEmission(itemToDelete.id);
            }
        } catch (error) {
            console.error("Error removing emission:", error);
            showNotification('Error eliminando emisión', 'error');
        }
    };

    // NEW: Helper to get emissions relevant for a subtype (plus globals)
    const getEmissionsForSubtype = React.useCallback((subtype) => {
        const globals = ['Unidad', 'Media Caja', 'Caja'];
        const isLata = subtype && subtype.toLowerCase().includes('lata');

        // Auto-add Six Pack for any Lata
        if (isLata) {
            globals.push('Six Pack');
        }

        const custom = (rawEmissions || [])
            .filter(e => {
                const belongsToSubtype = e.subtype === subtype; // Strict match
                const isSixPack = e.name && e.name.toLowerCase().trim() === 'six pack';
                return belongsToSubtype && !isSixPack;
            })
            .map(e => e.name);

        const merged = Array.from(new Set([...globals, ...custom]));

        // FIX: Filter out emissions that are actually Beer Types (user error protection)
        // But preserve reserved system emissions
        const reservedKeywords = ['Unidad', 'Caja', 'Media Caja', 'Six Pack', 'Pack', 'Bulto'];

        return merged.filter(name => {
            // Always allow reserved keywords
            if (reservedKeywords.some(k => k.toLowerCase() === name.toLowerCase())) return true;

            // Remove "Six Pack" if not lata
            if (!isLata && name.toLowerCase().trim() === 'six pack') return false;

            // Filter out if it matches a Beer Type
            const isBeer = beerTypes.some(b => b.toLowerCase() === name.toLowerCase());
            if (isBeer) return false;

            return true;
        });
    }, [rawEmissions, beerTypes]);

    // --- COST & NET PROFIT MANAGEMENT ---

    const updateCostPrice = async (beer, emission, subtype, cost) => {
        const key = `${beer}_${emission}_${subtype}`;
        const newCost = parseFloat(cost);
        setCostPrices(prev => ({ ...prev, [key]: newCost }));

        const productId = productMap[beer];
        if (productId && organizationId) {
            await upsertCostPrice({
                organization_id: organizationId,
                product_id: productId,
                emission,
                subtype,
                cost: newCost
            });
        }
    };

    const getCostPrice = (beer, emission, subtype) => {
        // 1. Primero intentar obtener el costo exacto para esta emisión
        const key = `${beer}_${emission}_${subtype}`;
        const exactCost = costPrices[key];
        if (exactCost && exactCost > 0) {
            return exactCost;
        }

        // 2. Si no existe, calcular costo proporcional basado en el mejor costo disponible
        // Priority: Caja -> Media Caja -> Six Pack -> Unidad
        const emissionsToCheck = ['Caja', 'Media Caja', 'Six Pack', 'Unidad'];

        for (const em of emissionsToCheck) {
            const checkKey = `${beer}_${em}_${subtype}`;
            const storedCost = costPrices[checkKey];
            if (storedCost && storedCost > 0) {
                // Calcular costo por unidad desde la emisión encontrada
                const storedUnits = getUnitsPerEmission(em, subtype);
                const unitCost = storedCost / storedUnits;

                // Multiplicar por las unidades de la emisión solicitada
                const requestedUnits = getUnitsPerEmission(emission, subtype);
                return unitCost * requestedUnits;
            }
        }

        return 0;
    };

    // Helper to get the best "Unit Cost" for calculations
    const getBestUnitCost = (beer, subtype) => {
        // Priority: Caja -> Media Caja -> Six Pack -> Unidad
        // We calculate down to unit cost
        const emissionsToCheck = ['Caja', 'Media Caja', 'Six Pack', 'Unidad'];

        for (const em of emissionsToCheck) {
            const cost = getCostPrice(beer, em, subtype);
            if (cost > 0) {
                const units = getUnitsPerEmission(em, subtype);
                return cost / units;
            }
        }
        return 0;
    };

    const getInventoryAssetValue = () => {
        let totalValue = 0;
        // Inventory keys are `${beer}_${subtype}` -> quantity (units)
        Object.entries(inventory).forEach(([key, quantity]) => {
            if (quantity <= 0) return;

            // Split key carefully
            // Assuming format Name_Subtype. 
            // If Name has underscore, we fail?
            // Existing logic in `checkAggregateStock` implies `inventory` keys are constructed reliably?
            // Let's use the known `beerTypes` to match safely.

            let beer = '';
            let subtype = '';

            // Find matching beer name from key start
            const match = beerTypes.find(b => key.startsWith(b + '_'));
            if (match) {
                beer = match;
                subtype = key.slice(beer.length + 1);
            } else {
                // Fallback split
                const parts = key.split('_');
                subtype = parts.pop();
                beer = parts.join('_');
            }

            const unitCost = getBestUnitCost(beer, subtype);
            totalValue += quantity * unitCost;
        });
        return totalValue;
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
        if (productId && organizationId) {
            // Real Upsert to Database
            await upsertPrice({
                organization_id: organizationId,
                product_id: productId,
                emission,
                subtype,
                price: newPrice,
                is_local: isLocal
            });
        }
    };

    const getPrice = React.useCallback((beer, emission, subtype, mode = 'standard') => {
        const suffix = mode === 'local' ? '_local' : '';
        const key = `${beer}_${emission}_${subtype}${suffix}`;
        let price = prices[key];
        if (mode === 'local' && (price === undefined || price === null)) {
            const standardKey = `${beer}_${emission}_${subtype}`;
            price = prices[standardKey];
        }
        return price || 0;
    }, [prices]);

    const updateConversion = async (emission, units, subtype) => {
        const key = `${emission}_${subtype}`;
        const newUnits = parseInt(units, 10);
        setConversions(prev => ({ ...prev, [key]: newUnits }));

        if (organizationId) {
            await upsertEmission({
                organization_id: organizationId,
                name: emission,
                subtype,
                units: newUnits
            });
        }
    };

    const getUnitsPerEmission = (emission, subtype) => {
        if (!emission || emission === 'Unidad') return 1;
        if (emission === 'Libre') return 1;
        if (emission === 'Six Pack') return 6;

        const conversionKey = `${emission}_${subtype}`;
        if (conversions[conversionKey]) return conversions[conversionKey];

        const dbEmission = rawEmissions.find(e =>
            e.name === emission &&
            (e.subtype === subtype || (e.subtype && subtype && e.subtype.toLowerCase() === subtype.toLowerCase()))
        );
        if (dbEmission && dbEmission.units) return dbEmission.units;

        const legacy = rawEmissions.find(e => e.name === emission && !e.subtype);
        if (legacy && legacy.units) return legacy.units;

        if (emission === 'Caja') {
            if (subtype && subtype.toLowerCase().includes('lata')) return 24;
            if (subtype === 'Botella Tercio') return 24;
            return 36;
        }
        if (emission === 'Media Caja') {
            if (subtype && subtype.toLowerCase().includes('lata')) return 12;
            if (subtype === 'Botella Tercio') return 12;
            return 18;
        }
        return 1;
    };

    // --- EXCHANGE RATES ---

    const updateCustomRate = async (value) => {
        const rawValue = value.toString().replace(/,/g, '');
        if (rawValue === '') {
            setExchangeRates(prev => ({ ...prev, custom: 0 }));
            return;
        }
        const newVal = parseFloat(rawValue);
        if (isNaN(newVal)) return;

        const updated = { ...exchangeRates, custom: newVal };
        setExchangeRates(updated);

        if (organizationId) {
            await upsertSetting(organizationId, 'exchangeRates', updated);
        }
    };

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            const [bcvRes, euroRes, historyRes] = await Promise.allSettled([
                fetch('https://ve.dolarapi.com/v1/dolares/oficial'),
                fetch('https://api.dolarvzla.com/public/exchange-rate'),
                fetch('https://api.dolarvzla.com/public/exchange-rate/list')
            ]);

            let bcv = 0;
            let euro = 0;
            let history = [];
            let nextRates = null;

            if (euroRes.status === 'fulfilled') {
                const data = await euroRes.value.json();
                if (data?.current && data?.previous) {
                    const now = new Date();
                    const localToday = now.toISOString().split('T')[0];
                    if (data.current.date > localToday) {
                        bcv = data.previous.usd;
                        euro = data.previous.eur;
                        nextRates = data.current;
                    } else {
                        bcv = data.current.usd;
                        euro = data.current.eur;
                    }
                }
            }

            if (!bcv && bcvRes.status === 'fulfilled') {
                const data = await bcvRes.value.json();
                if (data && data.promedio) bcv = data.promedio;
            }

            if (historyRes.status === 'fulfilled') {
                const data = await historyRes.value.json();
                if (Array.isArray(data?.rates)) history = data.rates.slice(0, 7);
            }

            const updated = {
                ...exchangeRates,
                bcv,
                euro,
                history,
                nextRates,
                lastUpdate: new Date().toLocaleString()
            };
            setExchangeRates(updated);

            if (organizationId) {
                await upsertSetting(organizationId, 'exchangeRates', updated);
            }
        } catch (error) {
            console.error("Error fetching rates:", error);
        }
    };

    const currentRate = mainCurrency === 'USD' ? (exchangeRates.bcv || 0) : (mainCurrency === 'EUR' ? (exchangeRates.euro || 0) : (exchangeRates.custom || 0));

    const getBsPrice = (beer, emission, subtype, mode = 'standard') => {
        const basePrice = getPrice(beer, emission, subtype, mode);
        return basePrice * currentRate;
    };

    // --- INVENTORY MANAGEMENT ---
    const addStock = async (beer, emission, subtype, quantity) => {
        const units = quantity * getUnitsPerEmission(emission, subtype);
        const key = `${beer}_${subtype}`;
        const newTotal = (inventory[key] || 0) + units;
        setInventory(prev => ({ ...prev, [key]: newTotal }));

        const productId = productMap[beer];
        if (productId && organizationId) {
            await upsertInventory({ organization_id: organizationId, product_id: productId, subtype, quantity: newTotal });
        }
    };

    const deductStock = async (beer, emission, subtype, quantity) => {
        const units = quantity * getUnitsPerEmission(emission, subtype);
        const key = `${beer}_${subtype}`;
        const newTotal = Math.max(0, (inventory[key] || 0) - units);
        setInventory(prev => ({ ...prev, [key]: newTotal }));

        const productId = productMap[beer];
        if (productId && organizationId) {
            await upsertInventory({ organization_id: organizationId, product_id: productId, subtype, quantity: newTotal });
        }
    };

    const setBaseStock = async (beer, subtype, units) => {
        const key = `${beer}_${subtype}`;
        setInventory(prev => ({ ...prev, [key]: units }));

        const productId = productMap[beer];
        if (productId && organizationId) {
            await upsertInventory({ organization_id: organizationId, product_id: productId, subtype, quantity: units });
        }
    };

    const checkStock = (beer, emission, subtype, quantity) => {
        const key = `${beer}_${subtype}`;
        const required = quantity * getUnitsPerEmission(emission, subtype);
        return (inventory[key] || 0) >= required;
    };

    const getInventory = (beer, subtype) => inventory[`${beer}_${subtype}`] || 0;

    const checkAggregateStock = (emission, subtype, requiredQuantity) => {
        const totalAvailable = beerTypes.reduce((acc, beer) => acc + (inventory[`${beer}_${subtype}`] || 0), 0);
        const requiredUnits = requiredQuantity * getUnitsPerEmission(emission, subtype);
        return totalAvailable >= requiredUnits;
    };

    // --- INVENTORY & WASTE HISTORY ---

    const updatePendingInventory = (beer, subtype, emission, delta) => {
        const key = `${beer}_${subtype}_${emission}`;
        setPendingInventory(prev => ({ ...prev, [key]: (prev[key] || 0) + delta }));
    };

    const commitInventory = async () => {
        const timestamp = new Date().toLocaleString();
        let totalCount = 0;
        const movements = [];

        for (const [key, quantity] of Object.entries(pendingInventory)) {
            const parts = key.split('_');
            const emission = parts.pop();
            const subtype = parts.pop();
            const beer = parts.join('_');
            const totalUnits = quantity * getUnitsPerEmission(emission, subtype);
            await addStock(beer, emission, subtype, quantity);
            totalCount += totalUnits;
            movements.push({ beer, subtype, emission, quantity, totalUnits });
        }

        const report = {
            organization_id: organizationId,
            movements,
            total_units: totalCount,
            type: 'INVENTORY',
            timestamp
        };

        if (organizationId) {
            // Filter out UI-only fields
            const { type, timestamp: _, ...dbPayload } = report;
            const { data } = await createInventoryHistory(dbPayload);
            if (data) report.id = data.id;
        }

        setInventoryHistory(prev => [report, ...prev].slice(0, 50));
        setPendingInventory({});
        return report;
    };

    const commitWaste = async () => {
        const timestamp = new Date().toLocaleString();
        let totalCount = 0;
        const movements = [];

        for (const [key, quantity] of Object.entries(pendingWaste)) {
            const parts = key.split('_');
            const emission = parts.pop();
            const subtype = parts.pop();
            const beer = parts.join('_');
            const totalUnits = quantity * getUnitsPerEmission(emission, subtype);
            await deductStock(beer, emission, subtype, quantity);
            totalCount += totalUnits;
            movements.push({ beer, subtype, emission, quantity, totalUnits });
        }

        const report = {
            organization_id: organizationId,
            movements,
            total_units: totalCount,
            type: 'WASTE',
            timestamp
        };

        if (organizationId) {
            // Filter out UI-only fields
            const { type, timestamp: _, ...dbPayload } = report;
            const { data } = await createWasteReport(dbPayload);
            if (data) report.id = data.id;
        }

        setBreakageHistory(prev => [report, ...prev].slice(0, 50));
        setPendingWaste({});
        return report;
    };

    const reportWaste = async (beer, subtype, quantity) => {
        const totalUnits = parseInt(quantity, 10);
        await deductStock(beer, 'Unidad', subtype, totalUnits);
        const report = {
            organization_id: organizationId,
            movements: [{ beer, subtype, emission: 'Unidad', quantity: totalUnits, totalUnits }],
            total_units: totalUnits,
            type: 'WASTE',
            timestamp: new Date().toLocaleString()
        };
        if (organizationId) await createWasteReport(report);
        setBreakageHistory(prev => [report, ...prev].slice(0, 50));
        showNotification(`Reportada Merma: ${quantity} ${beer}`, 'warning');
    };

    // --- WASTE / MERMA MANAGEMENT ---
    // const [pendingWaste, setPendingWaste] = useState({}); // Moved above
    // const [breakageHistory, setBreakageHistory] = useState(() => loadFromStorage('breakageHistory', [])); // Moved above

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

    // commitWaste function moved and refactored above

    // reportWaste function moved and refactored above

    const getPendingWaste = (beer, subtype, emission) => {
        const key = `${beer}_${subtype}_${emission}`;
        return pendingWaste[key] || 0;
    };

    // useEffect(() => { localStorage.setItem('breakageHistory', JSON.stringify(breakageHistory)); }, [breakageHistory]); // REMOVED

    return (
        <ProductContext.Provider value={{
            beerTypes, addBeerType, removeBeerType, emissionOptions, addEmissionType, removeEmissionType,
            subtypes, conversions, updateConversion, prices, updatePrice, inventory, setBaseStock, addStock, deductStock,
            checkStock, getInventory, getPrice, getBsPrice, exchangeRates, fetchRates, currentRate, updateCustomRate,
            getUnitsPerEmission, pendingInventory, updatePendingInventory, clearPendingInventory: () => setPendingInventory({}),
            commitInventory, getPendingInventory: (b, s, e) => pendingInventory[`${b}_${s}_${e}`] || 0,
            setPendingInventoryValue: (b, s, e, v) => setPendingInventory(prev => ({ ...prev, [`${b}_${s}_${e}`]: v })),
            inventoryHistory, getBeerColor, updateBeerColor, productMap, checkAggregateStock, getEmissionsForSubtype,
            pendingWaste, updatePendingWaste,
            clearPendingWaste: () => setPendingWaste({}), commitWaste, reportWaste, breakageHistory,
            getPendingWaste: (b, s, e) => pendingWaste[`${b}_${s}_${e}`] || 0,
            costPrices, updateCostPrice, getCostPrice, getInventoryAssetValue, mainCurrency, setMainCurrency, currencySymbol,
            resetApp: async () => { await resetDatabase(); window.location.reload(); }
        }}>
            {children}
        </ProductContext.Provider>
    );
};
