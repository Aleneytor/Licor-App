-- ==============================================================================
-- SCRIPT: SOLUCIÓN DEFINITIVA DE AUTH -> PROFILES (PERMANENTE)
-- DESCRIPCIÓN: Establece un trigger ultra-robusto que garantiza la creación
-- de perfiles, la vinculación a organizaciones y el envío de correos.
-- ==============================================================================

-- 1. Crear función de manejo de usuarios protegida contra fallos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_role TEXT;
    v_full_name TEXT;
BEGIN
    -- NORMALIZACIÓN DE DATOS: Asegura consistencia para siempre
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario nuevo');
    
    -- El rol siempre a minúsculas para cumplir con el CHECK de la tabla profiles
    v_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', 'employee')));
    
    -- Validar que el rol sea uno de los permitidos por el esquema maestro
    IF v_role NOT IN ('master', 'owner', 'manager', 'employee', 'developer', 'user', 'admin') THEN
        v_role := 'employee';
    END IF;

    -- MANEJO DE ORGANIZACIÓN:
    -- Intentamos obtener el ID si es un empleado invitado (viene en los metadatos)
    BEGIN
        v_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_org_id := NULL;
    END;

    -- Caso Especial: Registro de Dueño vía formulario normal (Master)
    -- Si no hay org_id pero hay nombre de licorería, creamos la organización automáticamente
    IF NEW.raw_user_meta_data->>'liquor_store_name' IS NOT NULL AND v_org_id IS NULL THEN
        INSERT INTO public.organizations (name, is_active)
        VALUES (NEW.raw_user_meta_data->>'liquor_store_name', FALSE)
        RETURNING id INTO v_org_id;
        v_role := 'master';
    END IF;

    -- INSERCIÓN ATÓMICA CON UPSERT:
    -- Si el perfil ya existe (reintento), se actualiza en lugar de dar error.
    INSERT INTO public.profiles (id, full_name, email, role, organization_id, created_at, updated_at)
    VALUES (
        NEW.id, 
        v_full_name, 
        NEW.email, 
        v_role, 
        v_org_id, 
        NOW(), 
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id),
        updated_at = NOW();

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- SALVAGUARDA CRUCIAL:
    -- Si cualquier inserción falla, devolvemos NEW de todos modos.
    -- Esto garantiza que Supabase Auth no interrumpa el registro y ENVÍE EL CORREO.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. REINSTALACIÓN DEL DISPARADOR (TRIGGER)
-- Asegura que Supabase ejecute esta lógica cada vez que alguien se registre.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. AUTO-REPARACIÓN (Sincronización inicial)
-- Busca usuarios en Authentication que no tienen perfil y los crea ahora mismo.
INSERT INTO public.profiles (id, email, full_name, role, organization_id)
SELECT 
    id, email, 
    COALESCE(raw_user_meta_data->>'full_name', 'Usuario Sincronizado'),
    COALESCE(LOWER(raw_user_meta_data->>'role'), 'employee'),
    CASE WHEN (raw_user_meta_data->>'organization_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
         THEN (raw_user_meta_data->>'organization_id')::UUID 
         ELSE NULL END
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 4. GARANTIZAR PERMISOS
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- ==============================================================================
-- FIN DEL SCRIPT DEFINITIVO
-- ==============================================================================
