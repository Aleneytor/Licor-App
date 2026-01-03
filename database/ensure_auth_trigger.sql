-- ==============================================================================
-- SCRIPT: REPARACIÓN DEFINITIVA DE AUTH -> PROFILES (ENLACE DE SEGURIDAD)
-- DESCRIPCIÓN: Reinstala el trigger que conecta el sistema de usuarios de 
-- Supabase con tu tabla de perfiles, asegurando que se envíe el email siempre.
-- ==============================================================================

-- 1. Crear función ultra-estable para el manejo de nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_full_name TEXT;
    v_role TEXT;
BEGIN
    -- Capturar metadatos con seguridad (evita nulos)
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nuevo Usuario');
    v_role := COALESCE(LOWER(NEW.raw_user_meta_data->>'role'), 'employee');

    -- Extraer organization_id (ID de la empresa) si existe en los metadatos
    BEGIN
        v_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_org_id := NULL;
    END;

    -- Caso Especial: Si el usuario se registra como Dueño de Negocio
    IF NEW.raw_user_meta_data->>'liquor_store_name' IS NOT NULL THEN
        -- Si viene sin org_id pero con nombre de tienda, es un nuevo Master
        v_role := 'master';
    END IF;

    -- INSERTAR EL PERFIL
    -- Usamos ON CONFLICT para evitar errores si el registro se reintenta
    INSERT INTO public.profiles (id, full_name, email, role, organization_id)
    VALUES (NEW.id, v_full_name, NEW.email, v_role, v_org_id)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id),
        email = EXCLUDED.email;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- ¡CRUCIAL!: Si hay un error al crear el perfil, permitimos que el usuario 
    -- de la tabla auth.users se cree de todos modos.
    -- ESTO PERMITE QUE SUPABASE ENVÍE EL CORREO DE CONFIRMACIÓN.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. REINSTALAR EL TRIGGER (El enlace que suele fallar o faltar)
-- Esto se asegura de que el trigger exista en la tabla interna de Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 3. GARANTIZAR PERMISOS AL POSTGRES OWNER
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- ==============================================================================
-- FIN DEL SCRIPT
-- Ejecuta esto en el SQL Editor de Supabase y prueba el registro de nuevo.
-- ==============================================================================
