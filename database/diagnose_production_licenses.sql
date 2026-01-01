-- ====================================================================
-- DIAGNÓSTICO DE LICENCIAS EN PRODUCCIÓN
-- ====================================================================
-- Ejecuta este script para verificar por qué las cuentas nuevas
-- muestran "ACTIVO" y "PREMIUM"
-- ====================================================================

-- 1. Verificar últimas organizaciones creadas
SELECT 
    'Últimas 10 organizaciones' as info,
    o.id,
    o.name,
    o.is_active,
    o.plan_type,
    o.trial_started_at,
    o.license_activated_at,
    o.license_expires_at,
    o.created_at,
    CASE 
        WHEN o.is_active = true AND o.license_expires_at IS NULL AND o.trial_started_at IS NULL THEN '🔴 PROBLEMA: Activa sin licencia ni trial'
        WHEN o.is_active = true AND o.trial_started_at IS NOT NULL THEN '🔸 En trial (correcto si activó)'
        WHEN o.is_active = true AND o.license_expires_at IS NOT NULL THEN '✅ Tiene licencia válida'
        WHEN o.is_active = false AND o.trial_started_at IS NULL THEN '✅ CORRECTO: Sin acceso'
        ELSE '⚠️ Revisar manualmente'
    END as diagnosis
FROM public.organizations o
ORDER BY o.created_at DESC
LIMIT 10;

-- 2. Verificar defaults de la tabla
SELECT 
    'Defaults de organizations' as info,
    column_name,
    column_default,
    is_nullable,
    CASE 
        WHEN column_name = 'is_active' AND column_default = 'false' THEN '✅'
        WHEN column_name = 'plan_type' AND (column_default IS NULL OR column_default = 'NULL::text') THEN '✅'
        WHEN column_name = 'trial_started_at' AND column_default IS NULL THEN '✅'
        ELSE '❌ Revisar'
    END as status
FROM information_schema.columns
WHERE table_name = 'organizations'
    AND table_schema = 'public'
    AND column_name IN ('is_active', 'plan_type', 'trial_started_at', 'license_expires_at')
ORDER BY ordinal_position;

-- 3. Contar organizaciones con problemas
SELECT 
    'Resumen de problemas' as info,
    COUNT(*) FILTER (WHERE is_active = true AND trial_started_at IS NULL AND license_expires_at IS NULL) as activas_sin_licencia,
    COUNT(*) FILTER (WHERE is_active = false AND trial_started_at IS NULL) as correctas_sin_acceso,
    COUNT(*) FILTER (WHERE trial_started_at IS NOT NULL) as en_trial,
    COUNT(*) FILTER (WHERE license_expires_at IS NOT NULL) as con_licencia,
    COUNT(*) as total
FROM public.organizations;

-- Si encuentras problemas, ejecuta:
-- database/APPLY_NOW_fix_active_organizations.sql
