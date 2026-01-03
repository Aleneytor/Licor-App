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

    // Prevent concurrent fetches
    const profileLoadingRef = React.useRef(false);

    // Initial Session Check
    useEffect(() => {
        let isMounted = true;

        const checkSession = async () => {
            console.log('Auth: Checking session...');
            const { data: { session } } = await supabase.auth.getSession();

            if (!isMounted) return;

            if (session) {
                console.log('Auth: Session found for', session.user.email);
                await fetchProfile(session.user);
            } else {
                console.log('Auth: No active session');
                setLoading(false);
            }
        };

        checkSession();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;
            console.log('Auth: onAuthStateChange event:', event);

            if (session) {
                await fetchProfile(session.user);
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
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (currentUser) => {
        if (!currentUser || profileLoadingRef.current) return;
        profileLoadingRef.current = true;

        console.log('Auth: Fetching profile for', currentUser.id);

        // Seteamos el usuario inmediatamente para que las rutas privadas no nos echen
        setUser(currentUser);

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
                console.error('Auth: Error fetching profile:', profileError);
                // Si el error es PGRST116 (no row found), significa que el trigger falló
                // o el perfil fue borrado. El usuario ya está seteado arriba, así que 
                // podrá entrar pero tendrá rol null.
                return;
            }

            if (profile) {
                console.log('Auth: Profile loaded, role:', profile.role);
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
                console.warn('Auth: No profile found for user');
            }
        } catch (err) {
            console.error('Auth: Error in fetchProfile:', err);
        } finally {
            console.log('Auth: Setting loading to false');
            setLoading(false);
            profileLoadingRef.current = false;
        }
    };

    const login = async (email, password) => {
        setLoading(true);
        console.log('Auth: login attempt for', email);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setLoading(false);
                throw error;
            }

            // Safety timeout: if onAuthStateChange doesn't trigger fetchProfile soon,
            // we at least stop the loading screen.
            setTimeout(() => {
                setLoading(false);
            }, 5000);

            return data;
        } catch (err) {
            setLoading(false);
            throw err;
        }
    };

    const logout = async () => {
        console.log('Auth: Logging out');
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // State updates handled by onAuthStateChange
    };

    const resetPassword = async (email) => {
        console.log('Auth: Reset password for', email);
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
