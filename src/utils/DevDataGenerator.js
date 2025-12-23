/**
 * DevDataGenerator.js
 * Tool to generate massive amounts of fake data for development testing.
 */

const CUSTOMERS = ['Juan Perez', 'Maria Garcia', 'Carlos Rodriguez', 'Ana Martinez', 'Luis Hernandez', 'Sofia Lopez', 'Diego Gonzalez', 'Elena Wilson', 'Pedro Sanchez', 'Lucia Raminez'];
const USERS = ['YESSI', 'Admin', 'Supervisor', 'Vendedor1', 'Vendedor2'];
const BEERS = ['Polar Pilsen', 'Polar Light', 'Solera Verde', 'Solera Azul'];
const SUBTYPES = ['Botella', 'Botella Tercio', 'Lata Pequeña', 'Lata Grande'];
const PAYMENT_METHODS = ['Efectivo', 'Pago Móvil', 'Bio Pago', 'Punto'];
const EMISSIONS = ['Unidad', 'Caja', 'Media Caja', 'Six Pack'];

// Helper to get random item from array
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to get random number between min and max
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

export const generateFakeData = () => {
    console.log("Generating fake data...");

    // 1. Generate Sales (400+)
    const sales = [];
    const now = new Date();

    const directSaleThreshold = Math.random(); // Random probability for this specific run
    console.log(`Direct sale probability for this run: ${(1 - directSaleThreshold).toFixed(2)}`);

    for (let i = 0; i < 400; i++) {
        // Purely random spread over last 45 days
        const daysBack = randomInt(0, 45);
        const randomDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
        randomDate.setHours(randomInt(9, 23), randomInt(0, 59), randomInt(0, 59));

        const itemsCount = randomInt(1, 4);
        const items = [];
        let total = 0;

        const isDirectSale = Math.random() > directSaleThreshold;
        const saleType = isDirectSale ? 'Llevar' : 'Local';

        for (let j = 0; j < itemsCount; j++) {
            const beer = randomItem(BEERS);
            const subtype = randomItem(SUBTYPES);
            const emission = randomItem(EMISSIONS);
            const quantity = randomInt(1, 3);

            // Randomize unit weights: $1.25 to $2.25 per bottle/can base
            const baseRate = randomInt(125, 225) / 100;
            let packUnits = 1;
            if (emission === 'Caja') packUnits = (subtype.includes('Lata') ? 24 : 36);
            if (emission === 'Media Caja') packUnits = (subtype.includes('Lata') ? 12 : 18);
            if (emission === 'Six Pack') packUnits = 6;

            const unitPrice = parseFloat((baseRate * packUnits).toFixed(2));

            items.push({
                id: `fake-item-${i}-${j}`,
                name: beer,
                beerType: beer, // Compatibility
                emission: emission,
                subtype: subtype,
                quantity: quantity,
                unitPriceUsd: unitPrice,
                totalPriceUsd: unitPrice * quantity,
                addedAt: randomDate.toISOString()
            });
            total += unitPrice * quantity;
        }

        sales.push({
            id: `fake-sale-${i}`,
            ticketNumber: 1000 + i,
            customerName: isDirectSale && Math.random() > 0.3 ? 'Venta Directa' : randomItem(CUSTOMERS),
            status: 'PAID',
            type: saleType,
            paymentMethod: randomItem(PAYMENT_METHODS),
            reference: 'REF' + randomInt(10000, 99999),
            createdBy: randomItem(USERS),
            createdAt: randomDate.toISOString(),
            closedAt: randomDate.toISOString(),
            items: items,
            totalAmountUsd: parseFloat(total.toFixed(2)),
            totalAmountBs: parseFloat((total * 50).toFixed(2)),
            total: parseFloat(total.toFixed(2))
        });
    }

    // 2. Generate Inventory History (20+)
    const invHistory = [];
    for (let i = 0; i < 22; i++) {
        const daysBack = randomInt(0, 45);
        const randomDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
        randomDate.setHours(randomInt(9, 18), randomInt(0, 59));
        const movements = [];
        let totalUnits = 0;

        for (let j = 0; j < 3; j++) {
            const units = randomInt(10, 50);
            totalUnits += units;
            movements.push({
                beer: randomItem(BEERS),
                subtype: randomItem(SUBTYPES),
                emission: 'Caja',
                quantity: randomInt(1, 5),
                totalUnits: units
            });
        }

        invHistory.push({
            id: Date.now() - (i * 1000000),
            timestamp: randomDate.toLocaleString('es-VE'),
            movements: movements,
            totalUnits: totalUnits
        });
    }

    // 3. Generate Waste History (5+)
    const wasteHistory = [];
    for (let i = 0; i < 7; i++) {
        const daysBack = randomInt(0, 45);
        const randomDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
        randomDate.setHours(randomInt(10, 22), randomInt(0, 59));
        wasteHistory.push({
            id: Date.now() - (i * 1000000) - 500,
            timestamp: randomDate.toLocaleString('es-VE'),
            type: 'WASTE',
            movements: [{
                beer: randomItem(BEERS),
                subtype: randomItem(SUBTYPES),
                emission: 'Unidad',
                quantity: randomInt(1, 5),
                totalUnits: randomInt(1, 5)
            }],
            totalUnits: randomInt(1, 5)
        });
    }

    // 4. Update LocalStorage
    // We sort sales to make sure views that expect chron order are happy
    const sortedSales = sales.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));

    localStorage.setItem('pendingOrders', JSON.stringify(sortedSales));
    localStorage.setItem('inventoryHistory', JSON.stringify(invHistory));
    localStorage.setItem('breakageHistory', JSON.stringify(wasteHistory));

    // Also mock some initial inventory stock so it doesn't look empty
    const mockInventory = {};
    BEERS.forEach(beer => {
        SUBTYPES.forEach(subtype => {
            mockInventory[`${beer}_${subtype}`] = randomInt(50, 200);
        });
    });
    localStorage.setItem('mock_inventory', JSON.stringify(mockInventory));

    // 5. INSTANT REACTIVE REFRESH (No reload needed)
    if (window.__DEV_SET_ORDERS__) window.__DEV_SET_ORDERS__(sortedSales);
    if (window.__DEV_SET_INVENTORY__) window.__DEV_SET_INVENTORY__(mockInventory);
    if (window.__DEV_SET_INV_HISTORY__) window.__DEV_SET_INV_HISTORY__(invHistory);
    if (window.__DEV_SET_WASTE_HISTORY__) window.__DEV_SET_WASTE_HISTORY__(wasteHistory);

    console.log("¡Data inyectada reactivamente!");
};

export const clearAllData = () => {
    localStorage.removeItem('pendingOrders');
    localStorage.removeItem('inventoryHistory');
    localStorage.removeItem('breakageHistory');
    localStorage.removeItem('mock_inventory');
    localStorage.removeItem('mock_sales');

    if (window.__DEV_SET_ORDERS__) window.__DEV_SET_ORDERS__([]);
    if (window.__DEV_SET_INVENTORY__) window.__DEV_SET_INVENTORY__({});
    if (window.__DEV_SET_INV_HISTORY__) window.__DEV_SET_INV_HISTORY__([]);
    if (window.__DEV_SET_WASTE_HISTORY__) window.__DEV_SET_WASTE_HISTORY__([]);

    console.log("Data limpiada reactivamente");
};
