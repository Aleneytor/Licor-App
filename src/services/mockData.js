export const initialProducts = [
    { id: '1', name: 'Polar Pilsen', color: '#fbbf24', organization_id: 'local-org' },
    { id: '2', name: 'Polar Light', color: '#60a5fa', organization_id: 'local-org' },
    { id: '3', name: 'Solera Verde', color: '#4ade80', organization_id: 'local-org' },
    { id: '4', name: 'Solera Azul', color: '#3b82f6', organization_id: 'local-org' }
];

export const initialEmissions = [
    { id: '1', name: 'Unidad', units: 1 },
    { id: '2', name: 'Caja', units: 12 }, // Default, can be overridden by subtypes logic in Context
    { id: '3', name: 'Six Pack', units: 6 }
];

export const initialInventory = [
    // Example data
];

export const initialPrices = [
    // Example data
];

export const initialSettings = [
    { key: 'subtypes', value: ['Botella', 'Botella Tercio', 'Lata Pequeña', 'Lata Grande'] }
];
