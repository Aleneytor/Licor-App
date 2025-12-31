-- ====================================================================
-- SISTEMA DE PRUEBA GRATUITA DE 7 DÍAS
-- ====================================================================
-- Este script habilita un trial de 7 días automático para todas las 
-- nuevas organizaciones sin necesidad de ingresar una licencia.
-- ====================================================================

-- 1. AGREGAR COLUMNA PARA RASTREAR SI YA USARON EL TRIAL
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- 2. FUNCIÓN HELPER PARA VERIFICAR SI EL TRIAL ESTÁ ACTIVO
CREATE OR REPLACE FUNCTION public.is_trial_active(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    org_record RECORD;
    trial_end_date TIMESTAMPTZ;
BEGIN
    -- Obtener información de la organización
    SELECT 
        trial_started_at,
        is_active,
        license_expires_at,
        plan_type
    INTO org_record
    FROM public.organizations
    WHERE id = org_id;

    -- Si no existe la organización, retornar false
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Si ya tiene una licencia activa, no necesita trial
    IF org_record.is_active = TRUE THEN
        -- Verificar si no está expirada
        IF org_record.license_expires_at IS NULL OR org_record.license_expires_at > NOW() THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Si tiene trial_started_at, verificar si aún está dentro de los 7 días
    IF org_record.trial_started_at IS NOT NULL THEN
        trial_end_date := org_record.trial_started_at + INTERVAL '7 days';
        IF NOW() < trial_end_date THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- En cualquier otro caso, no tiene acceso
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ACTUALIZAR EL TRIGGER DE CREACIÓN DE USUARIO PARA INCLUIR TRIAL
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

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
        -- Crear la organización SIN activar el trial automáticamente
        -- El trial se activará cuando el usuario presione el botón "Probar 7 Días"
        INSERT INTO public.organizations (
            name,
            trial_started_at,  -- NULL por defecto
            is_active,
            plan_type
        ) VALUES (
            v_liquor_store_name,
            NULL,   -- ⭐ NO activar trial automáticamente
            FALSE,  -- No tienen licencia aún
            NULL    -- Sin plan hasta que activen
        )
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
        -- Crear perfil normal (sin organización, sin trial)
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

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. NO ACTUALIZAR organizaciones existentes automáticamente
-- El trial debe activarse manualmente presionando el botón "Probar 7 Días"
-- Si quieres dar trial a organizaciones específicas, hazlo manualmente con:
-- UPDATE public.organizations
-- SET trial_started_at = NOW()
-- WHERE id = 'organization_id_here';

-- 5. FUNCIÓN PARA OBTENER INFO DEL TRIAL (útil para el frontend)
CREATE OR REPLACE FUNCTION public.get_trial_info(org_id UUID)
RETURNS TABLE (
    has_trial BOOLEAN,
    trial_active BOOLEAN,
    trial_started TIMESTAMPTZ,
    trial_ends TIMESTAMPTZ,
    days_remaining INTEGER
) AS $$
DECLARE
    org_record RECORD;
    trial_end_date TIMESTAMPTZ;
BEGIN
    -- Obtener información de la organización
    SELECT 
        trial_started_at,
        is_active
    INTO org_record
    FROM public.organizations
    WHERE id = org_id;

    -- Si no existe, retornar valores nulos
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, 0;
        RETURN;
    END IF;

    -- Si tiene trial iniciado
    IF org_record.trial_started_at IS NOT NULL THEN
        trial_end_date := org_record.trial_started_at + INTERVAL '7 days';
        
        RETURN QUERY SELECT 
            TRUE,
            (NOW() < trial_end_date AND org_record.is_active = FALSE),
            org_record.trial_started_at,
            trial_end_date,
            GREATEST(0, EXTRACT(DAY FROM (trial_end_date - NOW()))::INTEGER);
    ELSE
        -- No tiene trial
        RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. AGREGAR RPC PARA QUE EL FRONTEND PUEDA VERIFICAR EL TRIAL
-- Esto se puede llamar desde React con: supabase.rpc('check_trial_status')
CREATE OR REPLACE FUNCTION public.check_trial_status()
RETURNS JSON AS $$
DECLARE
    v_org_id UUID;
    v_trial_info RECORD;
    result JSON;
BEGIN
    -- Obtener organization_id del usuario actual
    SELECT organization_id INTO v_org_id
    FROM public.profiles
    WHERE id = auth.uid();

    -- Si no tiene organización, no tiene trial
    IF v_org_id IS NULL THEN
        RETURN json_build_object(
            'hasTrial', FALSE,
            'isTrialActive', FALSE,
            'daysRemaining', 0
        );
    END IF;

    -- Obtener info del trial
    SELECT * INTO v_trial_info
    FROM public.get_trial_info(v_org_id);

    RETURN json_build_object(
        'hasTrial', v_trial_info.has_trial,
        'isTrialActive', v_trial_info.trial_active,
        'trialStarted', v_trial_info.trial_started,
        'trialEnds', v_trial_info.trial_ends,
        'daysRemaining', v_trial_info.days_remaining
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- VERIFICACIÓN: VER ORGANIZACIONES CON TRIAL
-- ====================================================================
SELECT 
    o.id,
    o.name,
    o.trial_started_at,
    o.trial_started_at + INTERVAL '7 days' as trial_ends_at,
    CASE 
        WHEN o.trial_started_at IS NULL THEN 'Sin Trial'
        WHEN NOW() < (o.trial_started_at + INTERVAL '7 days') THEN 'Trial Activo'
        ELSE 'Trial Expirado'
    END as trial_status,
    CASE 
        WHEN o.is_active = TRUE THEN 'Con Licencia'
        ELSE 'Sin Licencia'
    END as license_status,
    EXTRACT(DAY FROM ((o.trial_started_at + INTERVAL '7 days') - NOW()))::INTEGER as days_remaining
FROM public.organizations o
ORDER BY o.created_at DESC
LIMIT 20;

-- ====================================================================
-- INSTRUCCIONES:
-- ====================================================================
-- 
-- 1. Ejecuta este script en el SQL Editor de Supabase
-- 2. El trial NO se activa automáticamente
-- 3. El usuario debe presionar el botón "Probar 7 Días" en el banner
-- 4. El botón ejecuta: UPDATE organizations SET trial_started_at = NOW()
-- 5. Los developers verán el trial activo en la tabla de licencias
-- 6. Puedes verificar el estado con: SELECT * FROM check_trial_status();
-- 
-- ====================================================================
