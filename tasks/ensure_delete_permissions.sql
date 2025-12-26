-- ==============================================================================
-- TAREA: ASEGURAR PERMISOS DE BORRADO (DELETE)
-- Descripción: Garantiza que el usuario pueda borrar Productos y Emisiones.
-- ==============================================================================

-- 1. Permisos para Productos (public.products)
-- Eliminamos política específica de borrado anterior para recrearla limpia
drop policy if exists "Borrar Productos" on public.products;

create policy "Borrar Productos" on public.products for delete using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);

-- 2. Permisos para Emisiones (public.emission_types)
-- A veces se configuran como POLICY FOR ALL, pero ser explícito es mejor.
drop policy if exists "Borrar Emisiones" on public.emission_types;

create policy "Borrar Emisiones" on public.emission_types for delete using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);

select 'Permisos de borrado verificados y aplicados.' as status;
