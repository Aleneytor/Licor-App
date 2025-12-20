import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // MOCK USER STATE
    const [user, setUser] = useState({
        id: 'mock-user-id',
        email: 'admin@licoreria.local',
        user_metadata: { name: 'Admin Local' }
    });
    const [role, setRole] = useState('admin');
    const [organizationId, setOrganizationId] = useState('local-org');
    const [organizationName, setOrganizationName] = useState('Licorería Local');
    const [loading, setLoading] = useState(false);

    const signOut = async () => {
        // No-op in local mode, or maybe reset local storage?
        console.log("Mock SignOut - Local Mode");
        // Optional: window.location.reload() to "reset" app state if needed
    };

    const value = {
        user,
        role,
        organizationId,
        organizationName,
        signOut,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
