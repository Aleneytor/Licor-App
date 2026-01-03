-- ==============================================================================
-- SCRIPT DE REPARACIÓN TOTAL: REGISTRO Y VISIBILIDAD DE INVITACIONES
-- DESCRIPCIÓN: Consolida la lógica de triggers para creación de perfiles
-- y ajusta las políticas RLS para visibilidad de invitaciones genéricas.
-- ==============================================================================

-- 1. Actualizar el Trigger Principal (Asegura vinculación de organización vía metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_liquor_store_name TEXT;
    v_full_name TEXT;
    v_role TEXT;
BEGIN
    -- Capturar metadatos enviados desde el frontend (signUp options.data)
    v_liquor_store_name := NEW.raw_user_meta_data->>'liquor_store_name';
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nuevo Usuario');
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');

    -- CASO A: Nuevo Dueño (registra licorería nueva)
    IF v_liquor_store_name IS NOT NULL AND v_liquor_store_name != '' THEN
        INSERT INTO public.organizations (name, is_active)
        VALUES (v_liquor_store_name, FALSE)
        RETURNING id INTO v_org_id;

        INSERT INTO public.profiles (id, full_name, email, role, organization_id)
        VALUES (NEW.id, v_full_name, NEW.email, 'master', v_org_id);
    
    -- CASO B: Invitado (se une a organización por ID contenido en los metadatos)
    ELSE
        BEGIN
            v_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_org_id := NULL;
        END;

        INSERT INTO public.profiles (id, full_name, email, role, organization_id)
        VALUES (NEW.id, v_full_name, NEW.email, v_role, v_org_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Asegurar que los perfiles existentes sin organización se vinculen (Opcional/Reparación)
UPDATE public.profiles p
SET organization_id = (u.raw_user_meta_data->>'organization_id')::UUID,
    full_name = COALESCE(u.raw_user_meta_data->>'full_name', p.full_name)
FROM auth.users u
WHERE p.id = u.id 
  AND p.organization_id IS NULL 
  AND u.raw_user_meta_data->>'organization_id' IS NOT NULL;

-- 3. Permitir que usuarios no logueados vean el NOMBRE de la empresa en la invitación
DROP POLICY IF EXISTS "Permitir ver nombre de org vía invitación" ON public.organizations;
CREATE POLICY "Permitir ver nombre de org vía invitación"
ON public.organizations FOR SELECT
USING (
    id IN (SELECT organization_id FROM public.organization_invites WHERE status = 'pending')
);

-- 4. Asegurar permisos para aceptar la invitación (UPDATE)
DROP POLICY IF EXISTS "Cualquiera puede aceptar su invitación" ON public.organization_invites;
CREATE POLICY "Cualquiera puede aceptar su invitación" 
ON public.organization_invites FOR UPDATE
USING (status = 'pending')
WITH CHECK (status = 'accepted');

-- 5. Garantizar acceso de lectura a las invitaciones pendientes (SELECT)
DROP POLICY IF EXISTS "Acceso público a invitaciones pendientes" ON public.organization_invites;
CREATE POLICY "Acceso público a invitaciones pendientes"
ON public.organization_invites FOR SELECT
USING (status = 'pending');

-- ==============================================================================
-- FIN DEL SCRIPT
-- Copia este contenido en el SQL Editor de Supabase y ejecútalo.
-- ==============================================================================
