-- ====================================================================
-- SCRIPT PARA ELIMINAR USUARIOS DE FORMA SEGURA
-- ====================================================================
-- Descripción: Este script permite eliminar usuarios y todos sus datos relacionados
-- ADVERTENCIA: Esta operación es IRREVERSIBLE. Asegúrate de tener backups.
-- ====================================================================

-- ===========================================
-- OPCIÓN 1: Eliminar UN usuario específico
-- ===========================================
-- Reemplaza 'USER_ID_AQUI' con el ID del usuario que quieres eliminar

DO $$
DECLARE
    v_user_id UUID := 'USER_ID_AQUI'; -- CAMBIA ESTO
    v_org_id UUID;
BEGIN
    -- 1. Obtener organization_id del usuario
    SELECT organization_id INTO v_org_id
    FROM public.profiles
    WHERE id = v_user_id;

    -- 2. Eliminar datos relacionados del usuario
    DELETE FROM public.analytics_events WHERE user_id = v_user_id;
    DELETE FROM public.inventory_history WHERE created_by = v_user_id;
    DELETE FROM public.waste_reports WHERE created_by = v_user_id;
    
    -- 3. Si el usuario era el único de la organización, eliminar la organización
    -- (Esto eliminará en cascada: products, inventory, prices, orders, etc.)
    IF v_org_id IS NOT NULL THEN
        DECLARE
            v_user_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO v_user_count
            FROM public.profiles
            WHERE organization_id = v_org_id AND id != v_user_id;
            
            IF v_user_count = 0 THEN
                -- Es el único usuario, eliminar organización
                DELETE FROM public.organizations WHERE id = v_org_id;
                RAISE NOTICE 'Organización % eliminada (era el único usuario)', v_org_id;
            ELSE
                RAISE NOTICE 'La organización % tiene otros usuarios, no se eliminará', v_org_id;
            END IF;
        END;
    END IF;
    
    -- 4. Eliminar el perfil
    DELETE FROM public.profiles WHERE id = v_user_id;
    
    -- 5. Eliminar el usuario de auth
    DELETE FROM auth.users WHERE id = v_user_id;
    
    RAISE NOTICE 'Usuario % eliminado exitosamente', v_user_id;
END $$;

-- ===========================================
-- OPCIÓN 2: Eliminar MÚLTIPLES usuarios
-- ===========================================
-- Reemplaza con los IDs de los usuarios que quieres eliminar

DO $$
DECLARE
    v_user_ids UUID[] := ARRAY[
        'a58cf7da-98f2-43bc-b4d3-cae42831d654'::UUID,
        'd895eebf-2135-4299-ad94-af6cb093cd8a'::UUID
        -- Agrega más IDs aquí separados por comas
    ];
    v_user_id UUID;
    v_org_id UUID;
BEGIN
    FOREACH v_user_id IN ARRAY v_user_ids
    LOOP
        BEGIN
            -- Obtener organization_id
            SELECT organization_id INTO v_org_id
            FROM public.profiles
            WHERE id = v_user_id;

            -- Eliminar datos relacionados
            DELETE FROM public.analytics_events WHERE user_id = v_user_id;
            DELETE FROM public.inventory_history WHERE created_by = v_user_id;
            DELETE FROM public.waste_reports WHERE created_by = v_user_id;
            
            -- Eliminar perfil
            DELETE FROM public.profiles WHERE id = v_user_id;
            
            -- Eliminar de auth
            DELETE FROM auth.users WHERE id = v_user_id;
            
            RAISE NOTICE 'Usuario % eliminado', v_user_id;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Error eliminando usuario %: %', v_user_id, SQLERRM;
        END;
    END LOOP;
END $$;

-- ===========================================
-- OPCIÓN 3: Eliminar todos los usuarios SIN organización
-- ===========================================
-- Usuarios que no pertenecen a ninguna organización (empleados sin asignar)

DELETE FROM public.analytics_events 
WHERE user_id IN (SELECT id FROM public.profiles WHERE organization_id IS NULL);

DELETE FROM public.inventory_history 
WHERE created_by IN (SELECT id FROM public.profiles WHERE organization_id IS NULL);

DELETE FROM public.waste_reports 
WHERE created_by IN (SELECT id FROM public.profiles WHERE organization_id IS NULL);

DELETE FROM auth.users 
WHERE id IN (SELECT id FROM public.profiles WHERE organization_id IS NULL);

DELETE FROM public.profiles 
WHERE organization_id IS NULL;

-- ===========================================
-- VERIFICACIÓN: Ver usuarios restantes
-- ===========================================
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.organization_id,
    o.name as organization_name,
    p.created_at,
    CASE 
        WHEN o.id IS NULL THEN '❌ Sin organización'
        WHEN o.is_active THEN '✅ Org activa'
        ELSE '⚠️ Org inactiva'
    END as status
FROM public.profiles p
LEFT JOIN public.organizations o ON p.organization_id = o.id
ORDER BY p.created_at DESC;

-- ===========================================
-- SOLUCIÓN PERMANENTE: Modificar Foreign Keys
-- ===========================================
-- Para evitar este problema en el futuro, ejecuta esto UNA VEZ:

-- Profiles: Eliminar en cascada cuando se elimina el usuario
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Analytics: Eliminar en cascada
ALTER TABLE public.analytics_events
DROP CONSTRAINT IF EXISTS analytics_events_user_id_fkey;

ALTER TABLE public.analytics_events
ADD CONSTRAINT analytics_events_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Inventory History: Set NULL al eliminar usuario
ALTER TABLE public.inventory_history
DROP CONSTRAINT IF EXISTS inventory_history_created_by_fkey;

ALTER TABLE public.inventory_history
ADD CONSTRAINT inventory_history_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Waste Reports: Set NULL al eliminar usuario
ALTER TABLE public.waste_reports
DROP CONSTRAINT IF EXISTS waste_reports_created_by_fkey;

ALTER TABLE public.waste_reports
ADD CONSTRAINT waste_reports_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ===========================================
-- VERIFICAR QUE LAS FOREIGN KEYS ESTÉN BIEN
-- ===========================================
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;
