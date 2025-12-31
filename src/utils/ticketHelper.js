/**
 * Generates a unique alphanumeric ticket number.
 * Standard length is 6 characters (e.g., "7X9A2B").
 * This provides 36^6 = 2,176,782,336 combinations.
 */
export const generateTicketNumber = (length = 6) => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
