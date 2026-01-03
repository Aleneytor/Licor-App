-- ==============================================================================
-- SCRIPT: GESTIÓN DE EQUIPO (VER Y ELIMINAR USUARIOS)
-- ==============================================================================

-- 1. Permitir ver a otros miembros de la MISMA organización
-- Actualmente un usuario solo ve su propio perfil. Habilitamos ver a los compañeros.
DROP POLICY IF EXISTS "View team members" ON public.profiles;
CREATE POLICY "View team members" ON public.profiles
FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- 2. Función Segura para Eliminar Miembros
-- Permite a un Administrador/Dueño eliminar a un empleado de SU propia organización.
-- Elimina la cuenta de acceso (auth.users) y de perfiles (public.profiles).

CREATE OR REPLACE FUNCTION delete_team_member(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con permisos elevados para poder borrar de auth.users
AS $$
DECLARE
  requesting_user_org UUID;
  target_user_org UUID;
  requesting_user_role TEXT;
BEGIN
  -- 1. Verificar quién está pidiendo la eliminación
  SELECT organization_id, role INTO requesting_user_org, requesting_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- 2. Verificar a quién quieren eliminar
  SELECT organization_id INTO target_user_org
  FROM public.profiles
  WHERE id = target_user_id;

  -- 3. VALIDACIONES DE SEGURIDAD
  -- Solo roles administrativos pueden borrar
  IF requesting_user_role NOT IN ('OWNER', 'MANAGER', 'ADMIN', 'master', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: No tienes permisos de administrador.';
  END IF;

  -- Solo pueden borrar a gente de SU MISMA organización
  IF requesting_user_org IS NULL OR target_user_org IS NULL OR requesting_user_org != target_user_org THEN
    RAISE EXCEPTION 'Acceso denegado: No puedes eliminar usuarios externos.';
  END IF;

  -- No puedes eliminarte a ti mismo (seguridad anti-fail)
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta desde aquí.';
  END IF;

  -- 4. EJECUTAR ELIMINACIÓN
  -- Borrar de auth.users elimina automáticamente el profile por la relación FK (Cascade)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
