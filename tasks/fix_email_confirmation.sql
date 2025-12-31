-- ====================================================================
-- FIX: Deshabilitar confirmación de email y permitir registro directo
-- ====================================================================
-- Este script soluciona el problema de registro cuando Supabase no envía
-- correos de confirmación.
-- 
-- IMPORTANTE: Ejecuta este código en el SQL Editor de Supabase
-- ====================================================================

-- 1. DESHABILITAR CONFIRMACIÓN DE EMAIL
-- Esto permite que los usuarios se registren sin necesidad de confirmar email
-- NOTA: Esto se debe hacer en el Dashboard de Supabase:
-- Authentication > Providers > Email > Desactivar "Confirm email"

-- 2. VERIFICAR QUE LAS TABLAS EXISTEN
DO $$
BEGIN
    -- Verificar que la tabla profiles existe
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        RAISE EXCEPTION 'La tabla profiles no existe. Ejecuta primero el schema completo.';
    END IF;
    
    -- Verificar que la tabla organizations existe
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organizations') THEN
        RAISE EXCEPTION 'La tabla organizations no existe. Ejecuta primero el schema completo.';
    END IF;
END $$;

-- 3. RECREAR TRIGGER PARA AUTO-CREAR PROFILES
-- Este trigger crea automáticamente un perfil cuando un usuario se registra

-- Eliminar el trigger existente si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Crear la función del trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_liquor_store_name TEXT;
BEGIN
    -- Obtener el nombre de la licorería de los metadatos (si existe)
    v_liquor_store_name := NEW.raw_user_meta_data->>'liquor_store_name';

    -- Si el usuario es dueño (tiene liquor_store_name), crear organización
    IF v_liquor_store_name IS NOT NULL AND v_liquor_store_name != '' THEN
        -- Crear la organización
        INSERT INTO public.organizations (name)
        VALUES (v_liquor_store_name)
        RETURNING id INTO v_org_id;

        -- Crear perfil como MASTER
        INSERT INTO public.profiles (
            id,
            full_name,
            role,
            organization_id
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            'master',
            v_org_id
        );
    ELSE
        -- Crear perfil normal (sin organización)
        INSERT INTO public.profiles (
            id,
            full_name,
            role,
            organization_id
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            'user',
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. ASEGURAR POLÍTICAS RLS PARA PERMITIR INSERCIONES
-- Políticas para la tabla profiles

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Permitir la creación de perfiles durante el registro
CREATE POLICY "Allow profile creation during signup"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- El service role puede hacer todo
CREATE POLICY "Service role can manage all profiles"
    ON public.profiles
    USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role');

-- 5. POLÍTICAS PARA LA TABLA ORGANIZATIONS

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Masters can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Allow organization creation" ON public.organizations;

-- Habilitar RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver su organización
CREATE POLICY "Users can view their organization"
    ON public.organizations
    FOR SELECT
    USING (
        id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Los masters pueden actualizar su organización
CREATE POLICY "Masters can update their organization"
    ON public.organizations
    FOR UPDATE
    USING (
        id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid() AND role = 'master'
        )
    );

-- Permitir creación de organizaciones (necesario para el trigger)
CREATE POLICY "Allow organization creation"
    ON public.organizations
    FOR INSERT
    WITH CHECK (true);

-- 6. FUNCIÓN PARA VERIFICAR ESTADO
CREATE OR REPLACE FUNCTION public.debug_auth_status()
RETURNS TABLE (
    total_users BIGINT,
    confirmed_users BIGINT,
    pending_users BIGINT,
    total_profiles BIGINT,
    total_organizations BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM auth.users),
        (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
        (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL),
        (SELECT COUNT(*) FROM public.profiles),
        (SELECT COUNT(*) FROM public.organizations);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. VERIFICAR ESTADO ACTUAL
SELECT * FROM public.debug_auth_status();

-- ====================================================================
-- INSTRUCCIONES ADICIONALES:
-- ====================================================================
-- 
-- 1. Ve al Dashboard de Supabase
-- 2. Authentication > Providers > Email
-- 3. DESACTIVA la opción "Confirm email"
-- 4. Guarda los cambios
-- 
-- Esto permitirá que los usuarios se registren inmediatamente sin 
-- necesidad de confirmar su email.
-- 
-- Para PRODUCCIÓN, considera configurar un proveedor SMTP en:
-- Project Settings > Auth > SMTP Settings
-- ====================================================================

-- OPCIONAL: Confirmar manualmente usuarios existentes que quedaron pendientes
-- Descomenta las siguientes líneas si tienes usuarios que no se confirmaron:
/*
UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
*/

-- OPCIONAL: Ver usuarios pendientes de confirmación
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    raw_user_meta_data->>'full_name' as full_name
FROM auth.users
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC;
