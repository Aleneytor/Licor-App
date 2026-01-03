import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null); // 'master', 'admin', 'employee', 'normal'
    const [organizationId, setOrganizationId] = useState(null);
    const [organizationName, setOrganizationName] = useState(null);
    const [isLicenseActive, setIsLicenseActive] = useState(false); // Default to false until verified
    const [planType, setPlanType] = useState(null); // 'free', 'monthly', 'yearly'
    const [licenseExpiresAt, setLicenseExpiresAt] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial Session Check
    useEffect(() => {
        let isMounted = true;

        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (isMounted && session) {
                fetchProfile(session.user);
            } else if (isMounted) {
                setLoading(false);
            }
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!isMounted) return;

            if (session) {
                fetchProfile(session.user);
            } else {
                setUser(null);
                setRole(null);
                setOrganizationId(null);
                setOrganizationName(null);
                setIsLicenseActive(false);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (currentUser) => {
        try {
            // UNA SOLA query con JOIN para traer perfil + organización
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select(`
                    *,
                    organizations (
                        name,
                        is_active,
                        license_expires_at,
                        plan_type,
                        trial_started_at
                    )
                `)
                .eq('id', currentUser.id)
                .single();

            if (profileError) {
                console.error('Error fetching profile:', profileError);
                setLoading(false);
                return;
            }

            setUser(currentUser);

            if (profile) {
                setRole(profile.role);
                setOrganizationId(profile.organization_id);

                const org = profile.organizations;
                const isDev = profile.role?.toUpperCase() === 'DEVELOPER';

                if (org) {
                    setOrganizationName(org.name);
                    setPlanType(org.plan_type);
                    setLicenseExpiresAt(org.license_expires_at);

                    const isActive = org.is_active === true;
                    const expiryDate = org.license_expires_at ? new Date(org.license_expires_at) : null;
                    const isExpired = expiryDate ? expiryDate < new Date() : false;

                    const trialStarted = org.trial_started_at ? new Date(org.trial_started_at) : null;
                    const trialEnds = trialStarted ? new Date(trialStarted.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
                    const isInTrial = !!(trialStarted && trialEnds && new Date() < trialEnds && !isActive);

                    const hasValidPlan = org.plan_type !== null;
                    const finalIsActive = isDev || ((isActive && !isExpired && hasValidPlan) || isInTrial);
                    setIsLicenseActive(finalIsActive);
                } else {
                    setOrganizationName(null);
                    setPlanType(null);
                    setLicenseExpiresAt(null);
                    setIsLicenseActive(isDev);
                }
            } else {
                console.warn('No profile found for user');
            }
        } catch (err) {
            console.error('Error in fetchProfile:', err);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setLoading(false);
            throw error;
        }
        return data;
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // State updates handled by onAuthStateChange
    };

    const resetPassword = async (email) => {
        // Enviar el correo de recuperación a través de Supabase
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;
    };

    const updatePassword = async (newPassword) => {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        if (error) throw error;
    };

    const value = {
        user,
        role,
        organizationId,
        organizationName,
        loading,
        login,
        logout,
        resetPassword,
        updatePassword,
        isLicenseActive,
        planType,
        licenseExpiresAt,
        refreshLicense: async (forcedValue = null) => {
            const isDev = role?.toUpperCase() === 'DEVELOPER';
            if (isDev) {
                setIsLicenseActive(true);
                return;
            }

            if (forcedValue !== null) {
                setIsLicenseActive(forcedValue === true);
                return;
            }
            if (organizationId) {
                const { data, error } = await supabase.from('organizations').select('is_active, license_expires_at, plan_type, trial_started_at').eq('id', organizationId).single();
                if (!error && data) {
                    const isActive = data.is_active === true;
                    const expiryDate = data.license_expires_at ? new Date(data.license_expires_at) : null;
                    const isExpired = expiryDate ? expiryDate < new Date() : false;

                    // Verificar trial
                    const trialStarted = data.trial_started_at ? new Date(data.trial_started_at) : null;
                    const trialEnds = trialStarted ? new Date(trialStarted.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
                    const isInTrial = trialStarted && trialEnds && new Date() < trialEnds && !isActive;

                    setIsLicenseActive((isActive && !isExpired) || isInTrial);
                    setPlanType(data.plan_type);
                    setLicenseExpiresAt(data.license_expires_at);
                }
            } else {
                setIsLicenseActive(false);
            }
        }
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
