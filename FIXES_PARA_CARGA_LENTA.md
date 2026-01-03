# Problemas Detectados y Soluciones

## Problema 1: AuthContext sin caché (crítico)

**Archivo:** `src/context/AuthContext.jsx`

**Problema:** Cada vez que cambias de página, el AuthContext vuelve a cargar TODO el perfil y organización desde cero, causando pantallas en blanco.

**Solución:** Agregar caché de sesión

```javascript
// REEMPLAZAR líneas 17-40 con esto:

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
```

---

## Problema 2: fetchProfile hace 2 llamadas secuenciales

**Archivo:** `src/context/AuthContext.jsx`

**Problema:** Primero carga el perfil, LUEGO carga la organización. Si tienes conexión lenta, esto duplica el tiempo de carga.

**Solución:** Hacer una sola query con JOIN

```javascript
// REEMPLAZAR la función fetchProfile (líneas 42-109) con esto:

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
        }
    } catch (err) {
        console.error('Error in fetchProfile:', err);
    } finally {
        setLoading(false);
    }
};
```

---

## Problema 3: SettingsPage con useEffect mal configurados

**Archivo:** `src/pages/SettingsPage.jsx`

**Problema:** Los `useEffect` en los componentes internos (BeerDashboardCard) se ejecutan DEMASIADAS veces, causando re-renders infinitos.

**Solución:** Limitar dependencias del useEffect

Busca la línea 131-149 y REEMPLAZA con:

```javascript
useEffect(() => {
    if (beerName === 'Tercio') {
        setSubtype('Botella Tercio');
    }
}, [beerName]); // Solo cuando cambia el nombre de la cerveza

useEffect(() => {
    if (!normalizedQuery || normalizedQuery.length < 2) {
        setIsExpanded(false);
        return;
    }

    // Auto-expand solo con match fuerte
    if (searchScore >= 70) {
        setIsExpanded(true);
    }

    // Cambiar subtype basado en búsqueda
    if (isFuzzyMatch('lata', normalizedQuery)) {
        setSubtype(prev => prev.includes('Lata') ? prev : 'Lata Pequeña');
    } else if (isFuzzyMatch('botella', normalizedQuery)) {
        setSubtype('Botella');
    }
}, [normalizedQuery]); // SOLO cuando cambia la búsqueda, NO searchScore
```

---

## Problema 4: Supabase caché desactivado

**Archivo:** `src/supabaseClient.js`

Verifica que tengas esto:

```javascript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,  // DEBE estar en true
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    db: {
        schema: 'public'
    }
});
```

---

## Aplicar los cambios

1. Aplica los cambios en `AuthContext.jsx` (Problema 1 y 2)
2. Aplica el cambio en `SettingsPage.jsx` (Problema 3)
3. Verifica `supabaseClient.js` (Problema 4)
4. Recarga la app completamente (Ctrl + Shift + R)

Esto debería eliminar el 90% del problema de carga lenta.
