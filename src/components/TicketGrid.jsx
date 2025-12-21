import React, { useState } from 'react';
import TicketSlot from './TicketSlot';
import { useProduct } from '../context/ProductContext';
import { useOrder } from '../context/OrderContext';
import { Delete } from 'lucide-react';

export default function TicketGrid({ orderId, item, itemIndex }) {
    const { beerTypes, getPrice, getUnitsPerEmission, getBeerColor, currencySymbol } = useProduct();
    const { updateOrderItemSlot } = useOrder();

    const isLibre = item.emission === 'Libre';
    const totalUnits = isLibre ? (item.slots?.length || 0) : (item.quantity * getUnitsPerEmission(item.emission, item.subtype));

    // Helper to get safe slots array
    const getSlots = () => {
        if (isLibre) return item.slots || [];

        // Create full array of nulls based on current definition
        const displaySlots = Array(totalUnits).fill(null);

        // Merge stored slots if they exist
        if (item.slots && Array.isArray(item.slots)) {
            item.slots.forEach((val, idx) => {
                if (idx < totalUnits && val !== undefined) {
                    displaySlots[idx] = val;
                }
            });
        }

        return displaySlots;
    };

    const slots = getSlots();

    // Grouping Logic
    const getGroupedItems = () => {
        const groups = [];
        const seen = new Map(); // Map<BeerName, GroupIndex>

        slots.forEach((beer, index) => {
            if (beer) {
                if (seen.has(beer)) {
                    // Increment existing
                    groups[seen.get(beer)].count++;
                    groups[seen.get(beer)].indices.push(index); // Track indices to know which one to remove
                } else {
                    // New Group
                    seen.set(beer, groups.length);
                    groups.push({ type: beer, count: 1, indices: [index] });
                }
            }
        });
        return groups;
    };

    const groupedItems = getGroupedItems();
    const isFull = isLibre ? false : slots.every(s => s !== null);

    // Beer Selector
    const handleBeerSelect = (beer) => {
        const currentSlots = getSlots();
        // For Libre, we always append at the end. For fixed, we find nulls.
        const targetIndex = isLibre ? currentSlots.length : currentSlots.findIndex(s => s === null);

        if (targetIndex !== -1) {
            updateOrderItemSlot(orderId, itemIndex, targetIndex, beer);
        } else {
            alert('Ticket lleno');
        }
    };

    const handleRemoveItem = (group) => {
        if (confirm(`¿Eliminar 1 ${group.type}?`)) {
            // Remove the LAST added instance (highest index) naturally?
            // Or just the last index in our tracking array
            const indexToRemove = group.indices[group.indices.length - 1];
            updateOrderItemSlot(orderId, itemIndex, indexToRemove, null);
        }
    };

    return (
        <div className="ticket-grid-container">
            <div className="ticket-grid-header">
                <span className="ticket-grid-header-text">
                    {isLibre ? `${item.name} (${slots.length} Uds)` : (item.beerVariety === 'Variado' ? `${item.emission} (${slots.filter(s => s !== null).length}/${totalUnits})` : `${item.beerType} ${item.subtype} - ${item.emission} (${slots.filter(s => s !== null).length}/${totalUnits})`)}
                    {item.beerVariety === 'Variado' && (
                        <span style={{
                            marginLeft: '8px',
                            background: 'var(--text-primary)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            color: 'var(--bg-card)',
                            fontWeight: '700',
                            verticalAlign: 'middle'
                        }}>
                            Variado
                        </span>
                    )}
                </span>
                {/* Clear Button? */}
            </div>

            {/* The Grid (Aggregated) */}
            <div className="ticket-slots-grid">
                {/* Render Grouped Items */}
                {groupedItems.map((group, idx) => (
                    <TicketSlot
                        key={`${group.type}-${idx}`}
                        content={group.type}
                        count={group.count}
                        isEmpty={false}
                        color={getBeerColor(group.type)}
                        onClick={() => handleRemoveItem(group)}
                    />
                ))}

                {/* Render Single "Add" Button if space exists */}
                {!isFull && (
                    <TicketSlot
                        key="add-btn"
                        isEmpty={true}
                        content="Agregar"
                        onClick={() => {
                            // Optional: Focus the beer selector below?
                            // Or just visual cue. The user knows to click below.
                        }}
                    />
                )}
            </div>

            {/* Beer Selector Keyboard */}
            <div className="beer-selector-container">
                <p className="beer-selector-label">
                    Selecciona para llenar espacios vacíos
                </p>
                <div className="beer-selector-grid">
                    {beerTypes
                        .filter(beer => {
                            // Logic: If the item represents a specific beer (e.g. "Polar Pilsen"), 
                            // ONLY show that beer. If the item is "Variado" or generic, show all matching the price limit.

                            // 1. PRICE LIMIT LOGIC (Variado)
                            if (item.beerVariety === 'Variado') {
                                // Use baseBeer if available (Local Variado), fallback to beerType
                                const anchorBeer = item.baseBeer || item.beerType;
                                const mode = item.consumptionMode === 'Local' ? 'local' : 'standard';

                                // Only filter if we have a valid anchor to compare against
                                if (anchorBeer && !isLibre) {
                                    // Compare UNIT prices in the same subtype context
                                    const anchorPrice = getPrice(anchorBeer, 'Unidad', item.subtype, mode);
                                    const optionPrice = getPrice(beer, 'Unidad', item.subtype, mode);

                                    // If option is more expensive than anchor (with epsilon), hide it
                                    if (optionPrice > anchorPrice + 0.001) {
                                        return false;
                                    }
                                }
                                return true;
                            }

                            // 2. Exact Match Logic (Non-Variado)
                            // Check item.beerType first (standard in SalesPage), then item.name (fallback)
                            const typeToCheck = item.beerType || item.name;

                            // We check if the current ticket item's type EXACTLY matches a known beer type in the system.
                            // If it matches, we assume the user only wants to fill this crate with that specific beer.
                            const isSpecificBeer = beerTypes.includes(typeToCheck);

                            if (isSpecificBeer) {
                                return beer === typeToCheck;
                            }
                            return true; // Show all if "Variado" or unknown type
                        })
                        .map(beer => {
                            const color = getBeerColor(beer);
                            return (
                                <button
                                    key={beer}
                                    onClick={() => handleBeerSelect(beer)}
                                    className="beer-selector-btn"
                                    style={{
                                        background: color.bg, // Use user defined color
                                        color: color.text,
                                        borderColor: color.border
                                    }}
                                >
                                    {beer}
                                </button>
                            );
                        })}
                    {/* Backspace Button */}
                    <button
                        className="beer-selector-btn delete-btn"
                        onClick={() => {
                            // Find the last non-null slot (highest index)
                            const filledIndices = slots
                                .map((val, idx) => (val !== null ? idx : -1))
                                .filter(idx => idx !== -1);

                            if (filledIndices.length > 0) {
                                const lastIndex = Math.max(...filledIndices);
                                updateOrderItemSlot(orderId, itemIndex, lastIndex, null);
                            }
                        }}
                    >
                        <Delete size={20} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div >
    );
}
