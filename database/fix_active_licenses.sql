-- ====================================================================
-- FIX: Corrección de organizaciones con licencia activa incorrecta
-- ====================================================================
-- Fecha: 2025-12-31
-- Descripción: Corrige organizaciones que fueron creadas con is_active=TRUE
--              por error, dejándolas sin acceso hasta activación manual
-- ====================================================================

-- 1. Verificar organizaciones afectadas (SOLO LECTURA)
SELECT 
    id,
    name,
    is_active,
    plan_type,
    trial_started_at,
    license_expires_at,
    created_at
FROM public.organizations
WHERE 
    is_active = TRUE 
    AND trial_started_at IS NULL 
    AND license_expires_at IS NULL
ORDER BY created_at DESC;

-- 2. Corregir organizaciones recién creadas sin licencia ni trial
-- ADVERTENCIA: Esto desactivará el acceso para organizaciones que no deberían tenerlo
UPDATE public.organizations
SET 
    is_active = FALSE,
    plan_type = NULL
WHERE 
    is_active = TRUE 
    AND trial_started_at IS NULL 
    AND license_expires_at IS NULL
    AND license_key IS NULL;

-- 3. Verificar que la corrección se aplicó
SELECT 
    'Organizaciones corregidas' as status,
    COUNT(*) as count
FROM public.organizations
WHERE 
    is_active = FALSE 
    AND trial_started_at IS NULL 
    AND license_expires_at IS NULL;

-- 4. Mostrar todas las organizaciones actuales
SELECT 
    o.id,
    o.name,
    o.is_active as licencia_activa,
    o.plan_type as plan,
    o.trial_started_at as trial_inicio,
    CASE 
        WHEN o.trial_started_at IS NULL THEN 'Sin Trial'
        WHEN NOW() < (o.trial_started_at + INTERVAL '7 days') THEN 'Trial Activo'
        ELSE 'Trial Expirado'
    END as estado_trial,
    CASE 
        WHEN o.is_active = TRUE AND (o.license_expires_at IS NULL OR o.license_expires_at > NOW()) THEN 'Con Licencia Válida'
        WHEN o.is_active = TRUE AND o.license_expires_at < NOW() THEN 'Licencia Expirada'
        ELSE 'Sin Licencia'
    END as estado_licencia,
    o.created_at as fecha_creacion
FROM public.organizations o
ORDER BY o.created_at DESC;

-- ====================================================================
-- RESULTADO ESPERADO:
-- - Organizaciones nuevas: is_active=FALSE, plan_type=NULL, trial_started_at=NULL
-- - Organizaciones con trial: is_active=FALSE, trial_started_at<>NULL
-- - Organizaciones con licencia: is_active=TRUE, license_expires_at<>NULL
-- ====================================================================
