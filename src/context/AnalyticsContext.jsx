import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';
import { useLocation } from 'react-router-dom';

const AnalyticsContext = createContext();

export const useAnalytics = () => useContext(AnalyticsContext);

export const AnalyticsProvider = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();

    // 1. Track Page Navigation
    useEffect(() => {
        if (!user) return;

        const logNavigation = async () => {
            try {
                await supabase.from('analytics_events').insert([{
                    user_id: user.id,
                    event_type: 'NAVIGATE',
                    path: location.pathname,
                    viewport_w: window.innerWidth,
                    viewport_h: window.innerHeight
                }]);
            } catch (err) {
                console.error("Analytics Error (Nav):", err);
            }
        };

        logNavigation();
    }, [location.pathname, user]);

    // 2. Track Clicks (Global Listener)
    useEffect(() => {
        if (!user) return;

        const handleClick = async (e) => {
            // Only track relevant elements (buttons, links, inputs) or elements with IDs
            const target = e.target.closest('button, a, input, [role="button"]');

            // If it's a generic click on a div with no ID, maybe ignore?
            // Let's track everything that has text or ID for heatmap purity, 
            // but prioritize interactive elements for metadata.

            const elementId = target ? target.id : (e.target.id || '');
            const elementText = target ? (target.innerText || target.value) : (e.target.innerText || '');

            // Limit text length
            const cleanText = elementText ? elementText.substring(0, 50) : '';

            try {
                await supabase.from('analytics_events').insert([{
                    user_id: user.id,
                    event_type: 'CLICK',
                    path: location.pathname,
                    element_id: elementId,
                    element_text: cleanText,
                    x: e.clientX,
                    y: e.clientY,
                    viewport_w: window.innerWidth,
                    viewport_h: window.innerHeight
                }]);
            } catch (err) {
                // Silent fail
            }
        };

        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [user, location.pathname]);

    return (
        <AnalyticsContext.Provider value={{}}>
            {children}
        </AnalyticsContext.Provider>
    );
};
