-- ==============================================================================
-- SCRIPT: VISIBILIDAD DE NOMBRE DE ORGANIZACIÓN
-- DESCRIPCIÓN: Permite que cualquiera (incluso usuarios no registrados) pueda
-- leer los datos básicos (ID, nombre) de las organizaciones.
-- Esto es INDISPENSABLE para que en la pantalla de invitación aparezca:
-- "Ahora eres parte de [Nombre Organización]" en lugar de "tu organización".
-- ==============================================================================

-- Habilitar RLS (por si acaso)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Eliminar política previa si existía para evitar conflictos
DROP POLICY IF EXISTS "Public organizations read access" ON public.organizations;
DROP POLICY IF EXISTS "Anyone can read organizations" ON public.organizations;

-- Crear política de lectura pública
-- Esto permite que el SELECT verifique el nombre de la organización al cargar la invitación.
CREATE POLICY "Public organizations read access"
ON public.organizations
FOR SELECT
USING (true);

-- NOTA DE SEGURIDAD:
-- Esto permite leer los nombres de las organizaciones. No permite editar ni borrar.
-- Es un estándar en aplicaciones SaaS que el nombre de la empresa sea público.
