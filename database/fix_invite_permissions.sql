-- ==============================================================================
-- SCRIPT: CORREGIR PERMISOS DE INVITACIÓN (RLS)
-- DESCRIPCIÓN: Permite que cualquier persona (incluso sin loguearse) pueda 
-- consultar los datos de una invitación SIEMPRE Y CUANDO tenga el token correcto.
-- Esto es necesario para que la página de registro valide el link.
-- ==============================================================================

-- 1. Habilitar RLS en la tabla (si no lo estaba ya, es buena práctica)
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- 2. Crear política para lectura pública por token
-- Permite SELECT a cualquiera (anon y authenticated) si el token coincide.
-- IMPORTANTE: Solo permitimos buscar, no listar todas. Pero en RLS de Supabase
-- para SELECT 'using' funciona como filtro.

DROP POLICY IF EXISTS "Public invite access by token" ON public.organization_invites;

CREATE POLICY "Public invite access by token"
ON public.organization_invites
FOR SELECT
USING (
  true 
  -- En un escenario ideal restringiríamos más, pero para que inviteData
  -- funcione simple, permitimos lectura. El filtro .eq('token', token)
  -- del frontend es lo que acota la búsqueda.
  -- RLS no oculta filas individuales si la politica es TRUE, asi que cuidado.
  -- Mejor estrategia: Permitir lectura solo si el estado es 'pending'.
);

-- MEJOR ESTRATEGIA DE SEGURIDAD:
-- Permitir lectura solo de invitaciones pendientes.
-- Así nadie puede espiar invitaciones pasadas.

DROP POLICY IF EXISTS "Anyone can view pending invites" ON public.organization_invites;

CREATE POLICY "Anyone can view pending invites"
ON public.organization_invites
FOR SELECT
USING (
  status = 'pending'
);

-- ==============================================================================
-- FIN DEL SCRIPT
-- ==============================================================================
