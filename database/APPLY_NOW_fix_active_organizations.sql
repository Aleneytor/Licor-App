-- ====================================================================
-- CORRECCIÓN DE LICENCIAS ACTIVAS INCORRECTAS
-- ====================================================================
-- Fecha: 2026-01-01
-- Propósito: Corregir organizaciones que tienen licencia activa sin debería
-- 
-- CONTEXTO:
-- Las organizaciones creadas tienen is_active=TRUE por defecto incorrecto
-- Este script las corrige para que NO tengan acceso hasta activar trial
-- ====================================================================

-- ===========================================
-- PASO 1: VER QUÉ SE VA A CORREGIR
-- ===========================================
-- Ejecuta esto PRIMERO para ver qué organizaciones se van a modificar

SELECT 
    '🔍 Organizaciones que se van a corregir:' as info,
    name,
    is_active as licencia_activa_actual,
    plan_type as plan_actual,
    trial_started_at as trial_inicio,
    license_expires_at as licencia_expira,
    created_at as fecha_creacion
FROM public.organizations
WHERE 
    is_active = TRUE 
    AND trial_started_at IS NULL 
    AND license_expires_at IS NULL
ORDER BY created_at DESC;

-- Si este query NO devuelve resultados, ¡genial! No hay nada que corregir.
-- Si devuelve organizaciones, continúa con el PASO 2.

-- ===========================================
-- PASO 2: CORREGIR LAS ORGANIZACIONES
-- ===========================================
-- Este UPDATE quita el acceso a las organizaciones que no deberían tenerlo

UPDATE public.organizations
SET 
    is_active = FALSE,      -- Deshabilitar licencia
    plan_type = NULL        -- Quitar plan
WHERE 
    is_active = TRUE 
    AND trial_started_at IS NULL 
    AND license_expires_at IS NULL;

-- Esto afecta organizaciones que:
-- ✅ Tienen is_active = TRUE (problema)
-- ✅ NO tienen trial iniciado (no han activado los 7 días)
-- ✅ NO tienen licencia con fecha de expiración

-- NO afecta organizaciones que:
-- ❌ Tienen trial activo (trial_started_at tiene fecha)
-- ❌ Tienen licencia válida (license_expires_at tiene fecha)

-- ===========================================
-- PASO 3: VERIFICAR QUE SE CORRIGIÓ
-- ===========================================
-- Ejecuta esto DESPUÉS del UPDATE para confirmar

SELECT 
    '✅ Estado después de la corrección:' as info,
    name,
    is_active,
    plan_type,
    trial_started_at,
    CASE 
        WHEN is_active = TRUE AND license_expires_at IS NOT NULL THEN '✅ Tiene licencia válida'
        WHEN is_active = FALSE AND trial_started_at IS NOT NULL THEN '🔸 En período de prueba'
        WHEN is_active = FALSE AND trial_started_at IS NULL THEN '✅ Sin acceso (correcto)'
        ELSE '⚠️ Revisar manualmente'
    END as estado_final,
    created_at
FROM public.organizations
ORDER BY created_at DESC
LIMIT 10;

-- RESULTADO ESPERADO:
-- Todas las organizaciones recién creadas deberían mostrar:
-- - is_active: false
-- - plan_type: NULL
-- - trial_started_at: NULL
-- - estado_final: "Sin acceso (correcto)"

-- ===========================================
-- PASO 4: LIMPIAR CACHÉ Y PROBAR
-- ===========================================
-- Después de ejecutar este script:
--
-- 1. Cierra sesión en la app
-- 2. Limpia caché del navegador (Ctrl + Shift + Del)
-- 3. Opciones:
--    A) Inicia sesión con cuenta existente → Debería ver banner "Acceso Restringido"
--    B) Crea cuenta nueva → Debería ver banner "Acceso Restringido"
-- 4. Presiona "Probar 7 Días" → Debería activar el trial
-- 5. Recarga la app → Debería tener acceso completo
--
-- ===========================================

-- ===========================================
-- NOTAS ADICIONALES
-- ===========================================
--
-- Si después de esto sigues viendo cuentas con acceso automático:
-- 1. Verifica que ejecutaste el script: update_foreign_keys.sql
-- 2. Verifica el código de Register.jsx (líneas 60-65)
-- 3. Ejecuta diagnose_license_problem.sql de nuevo
--
-- Para PREVENIR el problema en el futuro:
-- - Los defaults de la tabla YA están corregidos (is_active=FALSE, plan_type=NULL)
-- - El código frontend YA especifica estos valores explícitamente
-- - Las nuevas cuentas NO deberían tener este problema
--
-- ===========================================
