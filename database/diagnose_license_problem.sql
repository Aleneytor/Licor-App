-- ====================================================================
-- DIAGNÓSTICO COMPLETO DEL PROBLEMA DE LICENCIAS
-- ====================================================================
-- Ejecuta este script para diagnosticar por qué las cuentas nuevas
-- tienen licencia activa automáticamente
-- ====================================================================

-- 1. Verificar el DEFAULT de plan_type
SELECT 
    'Verificando DEFAULT de plan_type' as check_name,
    column_default,
    CASE 
        WHEN column_default IS NULL OR column_default = 'NULL::text' THEN '✅ Correcto (NULL)'
        WHEN column_default = '''free''::text' THEN '❌ PROBLEMA: default es ''free'''
        ELSE '⚠️ Inesperado: ' || column_default
    END as status
FROM information_schema.columns
WHERE table_name = 'organizations' 
    AND column_name = 'plan_type'
    AND table_schema = 'public';

-- 2. Verificar DEFAULT de is_active
SELECT 
    'Verificando DEFAULT de is_active' as check_name,
    column_default,
    CASE 
        WHEN column_default = 'false' THEN '✅ Correcto (false)'
        WHEN column_default = 'true' THEN '❌ PROBLEMA: default es true'
        ELSE '⚠️ Inesperado: ' || column_default
    END as status
FROM information_schema.columns
WHERE table_name = 'organizations' 
    AND column_name = 'is_active'
    AND table_schema = 'public';

-- 3. Ver las últimas 5 organizaciones creadas
SELECT 
    'Últimas organizaciones creadas' as info,
    name,
    is_active,
    plan_type,
    trial_started_at,
    license_activated_at,
    license_expires_at,
    CASE 
        WHEN is_active = true AND license_expires_at IS NULL THEN '❌ PROBLEMA: Activa sin expiración'
        WHEN is_active = true AND license_expires_at IS NOT NULL THEN '⚠️ Tiene licencia válida'
        WHEN is_active = false AND trial_started_at IS NOT NULL THEN '🔸 En trial (correcto)'
        WHEN is_active = false AND trial_started_at IS NULL THEN '✅ Sin acceso (correcto)'
        ELSE '⚠️ Estado desconocido'
    END as status,
    created_at
FROM organizations
ORDER BY created_at DESC
LIMIT 5;

-- 4. Verificar foreign keys de emission_types
SELECT 
    'Verificando FK de emission_types' as check_name,
    tc.constraint_name,
    rc.delete_rule,
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN '✅ Correcto (CASCADE)'
        ELSE '⚠️ Inesperado: ' || rc.delete_rule
    END as status
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'emission_types'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name LIKE '%organization_id%';

-- 5. Verificar trigger de creación de usuario
SELECT 
    'Verificando trigger de handle_new_user' as check_name,
    trigger_name,
    event_manipulation,
    action_timing,
    CASE 
        WHEN trigger_name = 'on_auth_user_created' THEN '✅ Trigger existe'
        ELSE '⚠️ Nombre inesperado'
    END as status
FROM information_schema.triggers
WHERE event_object_table = 'users'
    AND trigger_schema = 'auth';

-- 6. Test de creación de organización manual
-- (Esto NO crea nada, solo muestra qué CREARÍA)
SELECT 
    'Test: Qué defaults se aplicarían' as info,
    column_name,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'organizations'
    AND table_schema = 'public'
    AND column_name IN ('is_active', 'plan_type', 'trial_started_at')
ORDER BY ordinal_position;

-- ====================================================================
-- ACCIONES BASADAS EN RESULTADOS
-- ====================================================================
-- 
-- Si plan_type muestra ❌:
--   → Ejecuta: ALTER TABLE organizations ALTER COLUMN plan_type SET DEFAULT NULL;
--
-- Si is_active muestra ❌:
--   → Ejecuta: ALTER TABLE organizations ALTER COLUMN is_active SET DEFAULT FALSE;
--
-- Si últimas orgs muestran ❌:
--   → Las cuentas ya creadas necesitan corrección manual
--   → Ejecuta: database/fix_active_licenses.sql
--
-- Si emission_types muestra ⚠️:
--   → Ejecuta la parte de emission_types de update_foreign_keys.sql
--
-- ====================================================================
