-- ==============================================================================
-- SCRIPT: ENABLE GENERIC INVITES (Habilitar Invitaciones Genéricas)
-- DESCRIPCIÓN: Modifica la tabla 'organization_invites' para permitir la 
-- creación de links de invitación sin asignar un email específico al principio.
-- ==============================================================================

-- 1. Permitir que el campo 'email' sea NULL
-- Esto es necesario porque al generar el link genérico aún no sabemos el email del usuario.
ALTER TABLE public.organization_invites 
ALTER COLUMN email DROP NOT NULL;

-- 2. Eliminar restricciones de unicidad antiguas
-- Antes, una invitación era única por (email + organización).
-- Ahora, como el email puede ser NULL, esa restricción fallaría o impediría múltiples links genéricos.
DROP INDEX IF EXISTS organization_invites_email_organization_id_key;
ALTER TABLE public.organization_invites 
DROP CONSTRAINT IF EXISTS organization_invites_unique;

-- 3. (Opcional) Agregar fecha de expiración
-- Por seguridad, los links de invitación caducan en 7 días por defecto.
ALTER TABLE public.organization_invites 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- 4. Crear índice optimizado
-- Para que la verificación del token en la página de registro sea muy rápida.
CREATE INDEX IF NOT EXISTS idx_organization_invites_token_status 
ON public.organization_invites(token, status) 
WHERE status = 'pending';

-- ==============================================================================
-- FIN DEL SCRIPT
-- Copia y pega todo este contenido en el SQL Editor de Supabase y ejecútalo.
-- ==============================================================================
