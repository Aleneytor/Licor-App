import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState(null);

    const showNotification = useCallback((message, type = 'info', duration = 3000) => {
        console.log("SHOWING NOTIFICATION:", message, type);
        const id = Date.now();
        setNotification({ id, message, type, duration });

        setTimeout(() => {
            setNotification(current => (current && current.id === id ? null : current));
        }, duration);
    }, []);

    const hideNotification = useCallback(() => {
        setNotification(null);
    }, []);

    return (
        <NotificationContext.Provider value={{ notification, showNotification, hideNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};
