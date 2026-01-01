-- ====================================================================
-- LIMPIAR EMAILS BLOQUEADOS EN SUPABASE AUTH
-- ====================================================================
-- Fecha: 2026-01-01
-- Propósito: Resolver el problema de emails que no se pueden reutilizar
-- 
-- PROBLEMA:
-- Después de eliminar un usuario, Supabase no permite registrar
-- el mismo email inmediatamente. El confirmation link no llega.
-- ====================================================================

-- ===========================================
-- PASO 1: VERIFICAR SI EL EMAIL EXISTE
-- ===========================================

SELECT 
    '🔍 Buscando email en auth.users' as info,
    id,
    email,
    email_confirmed_at,
    created_at,
    deleted_at,
    is_anonymous,
    banned_until
FROM auth.users
WHERE email = 'TU_EMAIL_AQUI@ejemplo.com';

-- Si aparece con deleted_at NOT NULL → El usuario está "soft deleted"
-- Si NO aparece → El email está libre (en teoría)

-- ===========================================
-- PASO 2: VER USUARIOS ELIMINADOS (SOFT DELETE)
-- ===========================================

SELECT 
    '🗑️ Usuarios eliminados (soft delete)' as info,
    id,
    email,
    deleted_at,
    created_at
FROM auth.users
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC
LIMIT 20;

-- Si tu email aparece aquí, ese es el problema

-- ===========================================
-- PASO 3: HARD DELETE - ELIMINAR COMPLETAMENTE
-- ===========================================
-- ⚠️ CUIDADO: Esto es más agresivo que el DELETE normal

-- Primero, encuentra el ID del usuario
SELECT id, email, deleted_at 
FROM auth.users 
WHERE email = 'TU_EMAIL_AQUI@ejemplo.com';

-- Luego, elimínalo HARD (sin soft delete protections)
-- IMPORTANTE: Reemplaza el ID

DELETE FROM auth.users 
WHERE id = 'USER_ID_AQUI' 
AND deleted_at IS NOT NULL;

-- Esto fuerza la eliminación completa del schema auth

-- ===========================================
-- PASO 4: LIMPIAR METADATA DE AUTH
-- ===========================================
-- A veces Supabase guarda metadata adicional

-- Verificar identities vinculadas
SELECT 
    '🔗 Identities vinculadas' as info,
    i.id,
    i.user_id,
    i.email,
    i.provider
FROM auth.identities i
LEFT JOIN auth.users u ON i.user_id = u.id
WHERE i.email = 'TU_EMAIL_AQUI@ejemplo.com';

-- Si aparecen identities huérfanas (user_id null), elimínalas
DELETE FROM auth.identities
WHERE email = 'TU_EMAIL_AQUI@ejemplo.com'
AND user_id NOT IN (SELECT id FROM auth.users);

-- ===========================================
-- PASO 5: VERIFICAR USER_IDS EN PUBLIC
-- ===========================================
-- Asegurarse de que no haya referencias en public schema

SELECT 
    '👤 Perfiles huérfanos' as info,
    p.id,
    p.email,
    p.full_name,
    'ELIMINAR ESTE' as accion
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;

-- Si hay perfiles sin usuario correspondiente, elimínalos
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- ===========================================
-- PASO 6: RESETEAR RATE LIMITS (Si aplica)
-- ===========================================
-- Supabase tiene rate limits para envío de emails
-- Verifica en Dashboard > Authentication > Rate Limits

-- No hay SQL para esto, pero puedes:
-- 1. Ir a Supabase Dashboard
-- 2. Authentication > Settings
-- 3. Security > Rate Limits
-- 4. Verificar que no hayas excedido el límite

-- ===========================================
-- PASO 7: VERIFICAR EMAIL TEMPLATES
-- ===========================================
-- Asegurarse de que los emails de confirmación estén habilitados

-- Verificación manual:
-- 1. Dashboard > Authentication > Email Templates
-- 2. "Confirm signup" debe estar ENABLED
-- 3. Verificar que la URL sea correcta

-- ===========================================
-- PASO 8: DESHABILITAR CONFIRMACIÓN (DESARROLLO)
-- ===========================================
-- Solo para desarrollo/testing local

-- Dashboard > Authentication > Settings
-- Email Auth > "Enable email confirmations" → OFF

-- ⚠️ IMPORTANTE: Volver a activar en producción

-- Con esto desactivado:
-- - Los usuarios se registran SIN confirmar email
-- - Acceso inmediato
-- - Puedes reutilizar emails sin esperar

-- ===========================================
-- SOLUCIÓN ALTERNATIVA: EMAILS CON +
-- ===========================================
-- Gmail y otros proveedores ignoran el texto después de +

-- Ejemplo:
-- test@gmail.com
-- test+1@gmail.com  → Llega a test@gmail.com
-- test+2@gmail.com  → Llega a test@gmail.com
-- test+dev@gmail.com → Llega a test@gmail.com

-- Todos llegan al mismo inbox pero Supabase los ve como emails diferentes

-- ===========================================
-- RESUMEN DE OPCIONES
-- ===========================================
--
-- OPCIÓN A: Esperar 15-30 minutos
--   ✅ Más segura
--   ❌ Más lenta
--
-- OPCIÓN B: Usar emails con + (test+1@mail.com)
--   ✅ Rápida
--   ✅ Todos llegan al mismo inbox
--   ✅ Ilimitados
--
-- OPCIÓN C: Hard delete + limpiar identities (este script)
--   ✅ Funciona inmediatamente
--   ⚠️ Más agresivo
--
-- OPCIÓN D: Deshabilitar confirmación (solo desarrollo)
--   ✅ Sin problemas de emails
--   ⚠️ Solo para local
--   ❌ NO usar en producción
--
-- ===========================================

-- ===========================================
-- VERIFICACIÓN FINAL
-- ===========================================

SELECT 
    '✅ Estado final del email' as verificacion,
    CASE 
        WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'TU_EMAIL_AQUI@ejemplo.com') 
            THEN '❌ Email aún existe en auth.users'
        WHEN EXISTS (SELECT 1 FROM auth.identities WHERE email = 'TU_EMAIL_AQUI@ejemplo.com')
            THEN '⚠️ Email existe en identities'
        WHEN EXISTS (SELECT 1 FROM public.profiles WHERE email = 'TU_EMAIL_AQUI@ejemplo.com')
            THEN '⚠️ Email existe en profiles'
        ELSE '✅ Email completamente limpio'
    END as estado;

-- Si muestra "✅ Email completamente limpio", puedes intentar registrarte de nuevo

-- ===========================================
