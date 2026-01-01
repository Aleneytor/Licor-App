1.

-- Enable UUID extension
create extension if not exists "uuid-ossp";
-- 1. Organization Table
create table if not exists organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- 2. Profiles Table (Linked to Auth Users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('admin', 'employee', 'master')) default 'employee',
  organization_id uuid references organizations on delete set null,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- 3. Products Table
create table if not exists products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color text,
  organization_id uuid references organizations on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- 4. Inventory Table
create table if not exists inventory (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products on delete cascade not null,
  subtype text not null, -- 'Botella', 'Caja', etc.
  quantity numeric default 0,
  organization_id uuid references organizations on delete cascade not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(product_id, subtype)
);
-- 5. Prices Table
create table if not exists prices (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products on delete cascade not null,
  emission text not null, -- 'Unidad', 'Caja'
  subtype text not null,  -- 'Botella', 'Lata'
  price numeric default 0,
  organization_id uuid references organizations on delete cascade not null,
  is_local boolean default true, -- For currency differentiation if needed
  unique(product_id, emission, subtype, is_local)
);
-- 6. Sales/Orders Table
create table if not exists orders (
  id uuid default uuid_generate_v4() primary key,
  ticket_number serial,
  total_amount numeric default 0,
  total_amount_usd numeric default 0,
  payment_method text,
  reference text,
  status text default 'PAID', -- 'PAID', 'OPEN'
  customer_name text,
  organization_id uuid references organizations on delete cascade not null,
  created_by uuid references profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  closed_at timestamp with time zone
);
-- 7. Order Items Table
create table if not exists order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders on delete cascade not null,
  product_id uuid references products on delete set null,
  product_name text, -- Cache name in case product is deleted
  quantity numeric default 1,
  price numeric default 0,
  emission text,
  subtype text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- 8. Row Level Security (RLS) Policies
-- Enable RLS on all tables
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table products enable row level security;
alter table inventory enable row level security;
alter table prices enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
-- Policies (Simplified for initial rollout: Users can see data from their own organization)
-- PROFILES: Users can read their own profile
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);
-- ORGANIZATIONS: Users can view their assigned organization
create policy "Users can view own organization" on organizations
  for select using (id in (select organization_id from profiles where id = auth.uid()));
-- PRODUCTS: View logic
create policy "Users can view products of their org" on products
  for select using (organization_id in (select organization_id from profiles where id = auth.uid()));
create policy "Admins/Master can insert products" on products
  for insert with check (
    organization_id in (select organization_id from profiles where id = auth.uid() and role in ('admin', 'master', 'manager'))
  );
-- (Add Update/Delete policies similarly as needed, keeping it simple for now to avoid lockouts)
-- INVENTORY: View/Update
create policy "Users can view inventory of their org" on inventory
  for select using (organization_id in (select organization_id from profiles where id = auth.uid()));
create policy "Users can update inventory of their org" on inventory
  for all using (organization_id in (select organization_id from profiles where id = auth.uid()));
-- PRICES: View/Update
create policy "Users can view prices of their org" on prices
  for select using (organization_id in (select organization_id from profiles where id = auth.uid()));
create policy "Admins can manage prices" on prices
  for all using (organization_id in (select organization_id from profiles where id = auth.uid()));
-- SALES (Orders):
create policy "Users can view orders of their org" on orders
  for select using (organization_id in (select organization_id from profiles where id = auth.uid()));
create policy "Users can insert orders for their org" on orders
  for insert with check (organization_id in (select organization_id from profiles where id = auth.uid()));
create policy "Users can update orders of their org" on orders
  for update using (organization_id in (select organization_id from profiles where id = auth.uid()));
-- ORDER ITEMS:
create policy "Users can view order items of their org" on order_items
  for select using (
    exists (select 1 from orders where orders.id = order_items.order_id and orders.organization_id in (select organization_id from profiles where id = auth.uid()))
  );
create policy "Users can insert order items" on order_items
  for insert with check (
    exists (select 1 from orders where orders.id = order_items.order_id and orders.organization_id in (select organization_id from profiles where id = auth.uid()))
  );
-- STORAGE BUCKETS (If needed later for images)
-- insert into storage.buckets (id, name) values ('products', 'products');

2.

-- PATCH: Organization Invites Table
create table if not exists organization_invites (
  id uuid default uuid_generate_v4() primary key,
  email text not null,
  role text not null, 
  organization_id uuid references organizations on delete cascade not null,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(email, organization_id)
);

-- Enable RLS
alter table organization_invites enable row level security;

-- Policies
create policy "Users can view invites of their org" on organization_invites
  for select using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Admins can create invites" on organization_invites
  for insert with check (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

create policy "Admins can delete invites" on organization_invites
  for delete using (
    organization_id in (select organization_id from profiles where id = auth.uid())
  );

3.

-- PATCH: Fix RLS Permissions
drop policy if exists "Admins can create invites" on organization_invites;
drop policy if exists "Admins can delete invites" on organization_invites;

create policy "Admins can create invites" on organization_invites
  for insert with check (
    organization_id in (
        select organization_id from profiles 
        where id = auth.uid() 
        and lower(role) in ('admin', 'master', 'owner')
    )
  );

create policy "Admins can delete invites" on organization_invites
  for delete using (
    organization_id in (
        select organization_id from profiles 
        where id = auth.uid() 
        and lower(role) in ('admin', 'master', 'owner')
    )
  );


4.


-- 1. Asegurar que la tabla de productos existe con las columnas necesarias
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    UNIQUE(organization_id, name)
);

-- 2. Habilitar RLS (Seguridad a nivel de fila)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 3. Borrar políticas viejas para evitar conflictos
DROP POLICY IF EXISTS "Ver Productos" ON public.products;
DROP POLICY IF EXISTS "Crear Productos" ON public.products;
DROP POLICY IF EXISTS "Editar Productos" ON public.products;
DROP POLICY IF EXISTS "Borrar Productos" ON public.products;

-- 4. Crear políticas granuladas vinculadas a la organización del usuario
-- Esto permite que solo los miembros de la misma organización vean/creen sus productos.

CREATE POLICY "Ver Productos" ON public.products FOR SELECT 
USING ( organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY "Crear Productos" ON public.products FOR INSERT 
WITH CHECK ( organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY "Editar Productos" ON public.products FOR UPDATE 
USING ( organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY "Borrar Productos" ON public.products FOR DELETE 
USING ( organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) );

-- 5. Verificar que tu perfil tenga asignada la organización (opcional pero recomendado)
-- Si intentas agregar un producto y falla el permiso, es porque tu perfil tiene organization_id NULL.



5.


-- 1. Agregar la columna de organización a la tabla de emisiones
ALTER TABLE public.emission_types 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Habilitar la seguridad RLS
ALTER TABLE public.emission_types ENABLE ROW LEVEL SECURITY;

-- 3. Crear las políticas para que cada local vea solo sus emisiones
DROP POLICY IF EXISTS "Ver Emisiones" ON public.emission_types;
CREATE POLICY "Ver Emisiones" ON public.emission_types FOR SELECT 
USING ( organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) );

DROP POLICY IF EXISTS "Gestionar Emisiones" ON public.emission_types;
CREATE POLICY "Gestionar Emisiones" ON public.emission_types FOR ALL
USING ( organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) );

-- 4. (Opcional) Insertar las emisiones base para tu organización actual
-- Reemplaza 'TU_ORG_ID' por el ID de tu organización si quieres hacerlo manual, 
-- o deja que el app lo haga al crear nuevas.



6.


-- 1. Agregar la columna y crear el vínculo (Foreign Key)
ALTER TABLE public.emission_types 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Actualizar los registros existentes (opcional)
-- Si ya tenías datos, diles a qué organización pertenecen para que no queden huérfanos
-- UPDATE public.emission_types SET organization_id = 'EL_ID_DE_TU_ORGANIZACION' WHERE organization_id IS NULL;



7.


-- 1. Función que se ejecuta automáticamente al registrar un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_org_id UUID;
    store_name TEXT;
BEGIN
    -- Extraer el nombre del negocio de los metadatos del registro
    store_name := (new.raw_user_meta_data->>'liquor_store_name');

    -- CASO A: Es un Dueño (trae nombre de negocio)
    IF store_name IS NOT NULL AND store_name <> '' THEN
        -- Crear la organización
        INSERT INTO public.organizations (name)
        VALUES (store_name)
        RETURNING id INTO new_org_id;

        -- Crear el perfil como 'master' vinculado a la nueva organización
        INSERT INTO public.profiles (id, full_name, role, organization_id)
        VALUES (
            new.id,
            new.raw_user_meta_data->>'full_name',
            'master',
            new_org_id
        );
    
    -- CASO B: Es un Empleado invitado (no trae nombre de negocio)
    ELSE
        INSERT INTO public.profiles (id, full_name, role)
        VALUES (
            new.id,
            new.raw_user_meta_data->>'full_name',
            'employee'
        );
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el Trigger que activa la función arriba
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. IMPORTANTE: Permiso para que los usuarios vean el nombre de su organización
DROP POLICY IF EXISTS "Ver mi propia organización" ON public.organizations;
CREATE POLICY "Ver mi propia organización" ON public.organizations FOR SELECT 
USING ( id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) );



8.



-- ==============================================================================
-- SETUP: EMISIONES Y CONVERSIONES (TERCIO Y ESTÁNDAR)
-- Descripción: Asegura que la tabla de tipos de emisión tenga los valores 
-- correctos para Tercio (24/12) y Botella Estándar (36/18).
-- ==============================================================================

-- 1. Asegurar que la tabla existe
create table if not exists public.emission_types (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid references public.profiles(organization_id),
    name text not null,
    units integer not null default 1,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1.1 Asegurar que existe la columna 'subtype' y el constraint único actualizado
do $$ 
begin
    -- Agregar columna subtype si no existe
    if not exists (select 1 from information_schema.columns where table_name='emission_types' and column_name='subtype') then
        alter table public.emission_types add column subtype text;
    end if;

    -- Actualizar constraint único (eliminar viejo si existe, crear nuevo)
    -- Asumimos que el constraint viejo se llamaba algo genérico o basado en los campos
    alter table public.emission_types drop constraint if exists emission_types_organization_id_name_key;
    
    -- Intentar crear el nuevo constraint único que incluye subtype
    begin
        alter table public.emission_types add constraint emission_types_org_name_subtype_key unique(organization_id, name, subtype);
    exception when others then
        raise notice 'El constraint único ya existe o no se pudo crear';
    end;
end $$;

-- 2. Habilitar RLS (Row Level Security)
alter table public.emission_types enable row level security;

-- 3. Políticas de Seguridad (Si no existen)
do $$ 
begin
    if not exists (select 1 from pg_policies where policyname = 'Ver Emisiones') then
        create policy "Ver Emisiones" on public.emission_types for select using (
            organization_id in (select organization_id from public.profiles where id = auth.uid())
        );
    end if;

    if not exists (select 1 from pg_policies where policyname = 'Gestionar Emisiones') then
        create policy "Gestionar Emisiones" on public.emission_types for all using (
            organization_id in (select organization_id from public.profiles where id = auth.uid())
        );
    end if;
end $$;

-- 4. INSERTAR VALORES POR DEFECTO PARA CADA ORGANIZACIÓN EXISTENTE
-- Nota: Esto aplica los valores de Tercio (24/12) y Botella (36/18) 
-- a todas las organizaciones registradas.

insert into public.emission_types (organization_id, name, units, subtype)
select 
    distinct organization_id, 
    vals.name, 
    vals.units, 
    vals.subtype
from 
    public.profiles,
    (values 
        ('Caja', 36, 'Botella'),
        ('Media Caja', 18, 'Botella'),
        ('Caja', 24, 'Botella Tercio'),
        ('Media Caja', 12, 'Botella Tercio'),
        ('Caja', 24, 'Lata'),
        ('Media Caja', 12, 'Lata'),
        ('Six Pack', 6, 'Lata')
    ) as vals(name, units, subtype)
where 
    organization_id is not null
on conflict (organization_id, name, subtype) 
do update set units = excluded.units;

-- Confirmación
select 'Emisiones de Tercio (24/12) configuradas correctamente' as status;



9. 



-- ==============================================================================
-- SETUP: ACTIVACIÓN DE REALTIME Y SINCRONIZACIÓN TOTAL (CORREGIDO)
-- Descripción: Activa la escucha en tiempo real de Supabase de forma segura.
-- ==============================================================================

-- 1. ACTIVAR PUBLICACIÓN REALTIME DE FORMA SEGURA
-- Usamos un bloque DO para verificar si la tabla ya está en la publicación antes de añadirla.

do $$ 
begin
    -- 1.1 Asegurar que la publicación existe (Supabase la crea por defecto, pero por si acaso)
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;

    -- 1.2 Añadir tablas una por una si no están presentes
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products') then
        alter publication supabase_realtime add table public.products;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventory') then
        alter publication supabase_realtime add table public.inventory;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prices') then
        alter publication supabase_realtime add table public.prices;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'emission_types') then
        alter publication supabase_realtime add table public.emission_types;
    end if;
end $$;

-- 2. ASEGURAR RESTRICCIONES ÚNICAS (Para que el guardado/upsert no falle)

-- Para PRECIOS:
do $$ 
begin
    if not exists (select 1 from pg_constraint where conname = 'prices_unique_idx') then
        alter table public.prices add constraint prices_unique_idx unique (product_id, emission, subtype, is_local);
    end if;
exception when others then
    raise notice 'La restricción de precios ya existe.';
end $$;

-- Para INVENTARIO:
do $$ 
begin
    if not exists (select 1 from pg_constraint where conname = 'inventory_unique_idx') then
        alter table public.inventory add constraint inventory_unique_idx unique (product_id, subtype);
    end if;
exception when others then
    raise notice 'La restricción de inventario ya existe.';
end $$;

-- 3. HABILITAR REPLICACIÓN DE RÉPLICAS COMPLETAS
-- Esto asegura que el mensaje de Realtime contenga todos los datos.
alter table public.products replica identity full;
alter table public.inventory replica identity full;
alter table public.prices replica identity full;
alter table public.emission_types replica identity full;

-- Confirmación visual
select 'Sincronización Realtime configurada correctamente' as status;



10.



ALTER TABLE public.products ADD COLUMN format TEXT DEFAULT 'Botella';




11.



-- 1. Permisos para Productos
drop policy if exists "Borrar Productos" on public.products;
create policy "Borrar Productos" on public.products for delete using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);

-- 2. Permisos para Emisiones
drop policy if exists "Borrar Emisiones" on public.emission_types;
create policy "Borrar Emisiones" on public.emission_types for delete using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
);




12.



-- ==============================================================================
-- SETUP: ANALYTICS & DEVELOPER ROLE
-- Description: Creates the analytics_events table and configures security.
-- ==============================================================================

-- 1. Create Analytics Table
create table if not exists public.analytics_events (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id),
    event_type text not null, -- 'CLICK', 'NAVIGATE', 'ERROR'
    path text,
    element_id text,
    element_text text,
    x integer,
    y integer,
    viewport_w integer,
    viewport_h integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.analytics_events enable row level security;

-- 3. RLS Policies

-- A. INSERT: Authenticated users can log their own events
drop policy if exists "Insert Analytics" on public.analytics_events;
create policy "Insert Analytics" on public.analytics_events for insert with check (
    auth.uid() = user_id
);

-- B. SELECT: Only DEVELOPERS can see all events
-- We perform a check against the profiles table to see if the requesting user has role='DEVELOPER'
drop policy if exists "View Analytics" on public.analytics_events;
create policy "View Analytics" on public.analytics_events for select using (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role = 'DEVELOPER'
    )
);

-- 4. Update Profiles Check Constraint (if it exists) to allow 'DEVELOPER' role
-- Note: If you have a check constraint on role validation, you might need to drop/update it.
-- checking if a constraint exists:
do $$
begin
    if exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
        alter table public.profiles drop constraint profiles_role_check;
        alter table public.profiles add constraint profiles_role_check 
        check (role in ('OWNER', 'MANAGER', 'EMPLOYEE', 'DEVELOPER', 'master')); 
    end if;
end $$;

select 'Analytics setup complete. Table created and policies applied.' as status;



13.



-- ==============================================================================
-- FIX: ADD EMAIL TO PROFILES
-- Description: Adds the email column to the profiles table to allow 
--              verification of user existence during password recovery.
-- ==============================================================================

-- 1. Add the email column if it doesn't exist
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='email') then
        alter table public.profiles add column email text;
    end if;
end $$;

-- 2. Populate existing emails from auth.users
update public.profiles
set email = auth.users.email
from auth.users
where public.profiles.id = auth.users.id
and public.profiles.email is null;

-- 3. (Optional) Create a trigger to keep it updated automatically for new users
-- This ensures that every time a user is created in Auth, the email is copied to profiles.

create or replace function public.handle_new_user_email() 
returns trigger as $$
begin
  update public.profiles 
  set email = new.email 
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users update/insert
drop trigger if exists on_auth_user_created_update_email on auth.users;
create trigger on_auth_user_created_update_email
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_user_email();

select 'Column email added to profiles and sync trigger created.' as status;




14.



-- Create license_keys table
CREATE TABLE IF NOT EXISTS public.license_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    plan_type TEXT DEFAULT 'premium',
    status TEXT DEFAULT 'available', -- 'available', 'used'
    used_by_org_id UUID REFERENCES public.organizations(id),
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for license_keys (Only developers should manage them, but users need to read during activation)
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone logged in can try to read a key to check its validity during activation
CREATE POLICY "Anyone authenticated can read license keys" 
ON public.license_keys FOR SELECT 
TO authenticated 
USING (status = 'available' OR used_by_org_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

-- Policy: Only users with 'developer' role can insert/delete keys (managed in DB or via logic)
-- Note: Reusing the role check logic from other tables if existing. 
-- For now, enabling full access to authenticated for management if needed, but in production this is restricted.
CREATE POLICY "Developers can manage license keys" 
ON public.license_keys FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'developer'
    )
);





16.



-- Eliminar política anterior
DROP POLICY IF EXISTS "Developers can manage license keys" ON public.license_keys;

-- Crear nueva política que ignore mayúsculas y permita insertar
CREATE POLICY "Developers can manage license keys" 
ON public.license_keys FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND LOWER(role) = 'developer'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND LOWER(role) = 'developer'
    )
);




17.



-- Añadir columnas de activación a la tabla de organizaciones
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS license_key TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free';




18.



-- Añadir seguimiento de expiración a la tabla organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS license_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS license_activated_at TIMESTAMP WITH TIME ZONE;

-- Actualizar organizaciones ya activas (les da 30 días desde hoy)
UPDATE public.organizations 
SET 
    license_activated_at = NOW(),
    license_expires_at = NOW() + INTERVAL '30 days'
WHERE is_active = TRUE AND license_expires_at IS NULL;




19.



-- 1. Asegurar que las llaves sean únicas (No pueden existir duplicados)
ALTER TABLE public.license_keys 
ADD CONSTRAINT unique_key_string UNIQUE (key);

-- 2. Regla de Oro: Solo se puede actualizar una llave si está 'available'
-- Creamos un TRIGGER que protege la tabla license_keys
CREATE OR REPLACE FUNCTION protect_license_keys()
RETURNS TRIGGER AS $$
BEGIN
    -- Si intentan actualizar una llave que ya no está 'available', lanzamos error
    IF OLD.status = 'used' THEN
        RAISE EXCEPTION 'Esta licencia ya fue utilizada y no puede ser modificada.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_license_keys ON public.license_keys;
CREATE TRIGGER tr_protect_license_keys
BEFORE UPDATE ON public.license_keys
FOR EACH ROW EXECUTE FUNCTION protect_license_keys();

-- 3. Limpieza de seguridad: Si hay llaves que usaste 7 veces, las marcamos correctamente
-- Buscamos llaves que ya estén en organizaciones y las bloqueamos
UPDATE public.license_keys
SET status = 'used'
WHERE key IN (SELECT license_key FROM public.organizations WHERE license_key IS NOT NULL);




20.



-- 1. Limpiar políticas antiguas para evitar errores de duplicado
DROP POLICY IF EXISTS "Anyone authenticated can read license keys" ON public.license_keys;
DROP POLICY IF EXISTS "Developers can manage license keys" ON public.license_keys;

-- 2. Crear las reglas de seguridad (Políticas de RLS)
-- Permite leer llaves si están disponibles, si eres dev, o si es la de tu organización
CREATE POLICY "Anyone authenticated can read license keys" 
ON public.license_keys FOR SELECT 
TO authenticated 
USING (
    status = 'available' 
    OR 
    LOWER((SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1)) = 'developer'
    OR
    used_by_org_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- Permite a los desarrolladores hacer todo (Insertar, Borrar, Editar)
CREATE POLICY "Developers can manage license keys" 
ON public.license_keys FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND LOWER(role) = 'developer'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND LOWER(role) = 'developer'
    )
);

-- 3. Asegurar que las llaves sean únicas (Evita duplicados)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_key_string') THEN
        ALTER TABLE public.license_keys ADD CONSTRAINT unique_key_string UNIQUE (key);
    END IF;
END $$;

-- 4. Protección contra reutilización (Trigger de Seguridad)
CREATE OR REPLACE FUNCTION protect_license_keys()
RETURNS TRIGGER AS $$
BEGIN
    -- Bloquea cualquier intento de usar una llave que ya esté marcada como 'used'
    IF OLD.status = 'used' AND NEW.status = 'used' AND OLD.used_by_org_id IS NOT NULL THEN
        RAISE EXCEPTION 'Esta licencia ya fue utilizada y no puede ser modificada.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_license_keys ON public.license_keys;
CREATE TRIGGER tr_protect_license_keys
BEFORE UPDATE ON public.license_keys
FOR EACH ROW EXECUTE FUNCTION protect_license_keys();

-- 5. Sincronizar llaves usadas anteriormente
UPDATE public.license_keys
SET status = 'used'
WHERE key IN (SELECT license_key FROM public.organizations WHERE license_key IS NOT NULL);




21.



-- 1. ASEGURAR COLUMNAS EN ORGANIZACIONES
DO $$ 
BEGIN 
    -- Columnas de activación básica
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'license_key') THEN
        ALTER TABLE public.organizations ADD COLUMN license_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_active') THEN
        ALTER TABLE public.organizations ADD COLUMN is_active BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'plan_type') THEN
        ALTER TABLE public.organizations ADD COLUMN plan_type TEXT DEFAULT 'free';
    END IF;
    
    -- Columnas de vencimiento (CRÍTICAS para la nueva columna del menú Dev)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'license_expires_at') THEN
        ALTER TABLE public.organizations ADD COLUMN license_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'license_activated_at') THEN
        ALTER TABLE public.organizations ADD COLUMN license_activated_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. AJUSTAR TABLA DE KEYS (Sincronizar Plan Types)
-- Asegurar que la tabla existe con el campo plan_type
CREATE TABLE IF NOT EXISTS public.license_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    plan_type TEXT DEFAULT 'monthly', -- 'monthly', 'yearly', 'free'
    status TEXT DEFAULT 'available',
    used_by_org_id UUID REFERENCES public.organizations(id),
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SEGURIDAD (RLS) - Limpiar y Reinstalar
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read license keys" ON public.license_keys;
CREATE POLICY "Anyone authenticated can read license keys" 
ON public.license_keys FOR SELECT 
TO authenticated 
USING (status = 'available' OR used_by_org_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'DEVELOPER');

DROP POLICY IF EXISTS "Developers can manage license keys" ON public.license_keys;
CREATE POLICY "Developers can manage license keys" 
ON public.license_keys FOR ALL 
TO authenticated 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'DEVELOPER');

-- 4. SINCRONIZACIÓN DE EMAILS (Para recuperación de contraseñas)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- Actualizar correos existentes
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id AND p.email IS NULL;




22.


-- 1. PERMITIR QUE LOS USUARIOS ACTIVEN LLAVES
-- Esta política permite que cualquier usuario logueado cambie el estado de una llave 
-- de 'available' a 'used' siempre y cuando la llave esté disponible.
DROP POLICY IF EXISTS "Allow users to activate keys" ON public.license_keys;
CREATE POLICY "Allow users to activate keys" 
ON public.license_keys FOR UPDATE 
TO authenticated 
USING (status = 'available')
WITH CHECK (status = 'used');

-- 2. ASEGURAR PERMISOS DE LECTURA DURANTE ACTIVACIÓN
-- El usuario necesita poder leer la llave que intenta activar
DROP POLICY IF EXISTS "Allow reading available keys for activation" ON public.license_keys;
CREATE POLICY "Allow reading available keys for activation" 
ON public.license_keys FOR SELECT 
TO authenticated 
USING (status = 'available' OR used_by_org_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

-- 3. PERMISOS DE ORGANIZACIÓN (Por si acaso)
-- Asegura que el dueño de la organización pueda actualizar sus propios datos de licencia
DROP POLICY IF EXISTS "Owners can update their own organization license" ON public.organizations;
CREATE POLICY "Owners can update their own organization license" 
ON public.organizations FOR UPDATE 
TO authenticated 
USING (id IN (
    SELECT organization_id FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('OWNER', 'admin', 'master', 'manager')
));




23.



-- Permitir que los desarrolladores vean los detalles de todas las organizaciones
-- (Necesario para que el listado de licencias muestre los nombres y vencimientos correctamente)
CREATE POLICY "Developers can view all organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND LOWER(role) = 'developer'
    )
);




24.




-- ==============================================================================
-- SETUP: SINCRONIZACIÓN COMPLETA DE DATOS ENTRE DISPOSITIVOS
-- Descripción: Crea tablas adicionales para que TODOS los datos se guarden
-- en Supabase y no solo en localStorage. Esto permite sincronización
-- entre computadora y teléfono.
-- NOTA: No usamos foreign keys a profiles(organization_id) porque no tiene 
-- un constraint único. En su lugar, usamos RLS para asegurar el acceso.
-- ==============================================================================

-- 1. TABLA: organization_settings
-- Guarda configuraciones de la organización como moneda, tasas de cambio, etc.
create table if not exists public.organization_settings (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid not null,
    key text not null,
    value jsonb not null default '{}',
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint organization_settings_unique unique(organization_id, key)
);

-- 2. TABLA: cost_prices
-- Guarda los precios de costo para calcular ganancias netas
create table if not exists public.cost_prices (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid not null,
    product_id uuid not null references public.products(id) on delete cascade,
    emission text not null,
    subtype text not null,
    cost numeric(12, 2) not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint cost_prices_unique unique(organization_id, product_id, emission, subtype)
);

-- 3. TABLA: inventory_history
-- Historial de movimientos de inventario (entradas)
create table if not exists public.inventory_history (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid not null,
    movements jsonb not null default '[]',
    total_units integer not null default 0,
    created_by uuid references auth.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. TABLA: waste_reports
-- Historial de merma/pérdidas
create table if not exists public.waste_reports (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid not null,
    movements jsonb not null default '[]',
    total_units integer not null default 0,
    created_by uuid references auth.users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. TABLA: pending_orders (Tickets Abiertos que se sincronizan)
-- Permite ver los tickets abiertos desde cualquier dispositivo
create table if not exists public.pending_orders (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid not null,
    ticket_number integer not null,
    customer_name text default 'Cliente',
    status text not null default 'OPEN',
    type text default 'Local',
    payment_method text,
    reference text,
    items jsonb not null default '[]',
    payments jsonb default '[]',
    created_by text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- HABILITAR ROW LEVEL SECURITY
-- ==============================================================================

alter table public.organization_settings enable row level security;
alter table public.cost_prices enable row level security;
alter table public.inventory_history enable row level security;
alter table public.waste_reports enable row level security;
alter table public.pending_orders enable row level security;

-- ==============================================================================
-- POLÍTICAS DE SEGURIDAD
-- Usamos subquery a profiles para verificar que el usuario pertenece a la org
-- ==============================================================================

-- organization_settings: Ver y modificar solo de la propia organización
drop policy if exists "View Own Settings" on public.organization_settings;
create policy "View Own Settings" on public.organization_settings for select using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

drop policy if exists "Manage Own Settings" on public.organization_settings;
create policy "Manage Own Settings" on public.organization_settings for all using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

-- cost_prices: Ver y modificar solo de la propia organización
drop policy if exists "View Own Costs" on public.cost_prices;
create policy "View Own Costs" on public.cost_prices for select using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

drop policy if exists "Manage Own Costs" on public.cost_prices;
create policy "Manage Own Costs" on public.cost_prices for all using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

-- inventory_history: Ver y modificar solo de la propia organización
drop policy if exists "View Own Inventory History" on public.inventory_history;
create policy "View Own Inventory History" on public.inventory_history for select using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

drop policy if exists "Manage Own Inventory History" on public.inventory_history;
create policy "Manage Own Inventory History" on public.inventory_history for all using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

-- waste_reports: Ver y modificar solo de la propia organización
drop policy if exists "View Own Waste Reports" on public.waste_reports;
create policy "View Own Waste Reports" on public.waste_reports for select using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

drop policy if exists "Manage Own Waste Reports" on public.waste_reports;
create policy "Manage Own Waste Reports" on public.waste_reports for all using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

-- pending_orders: Ver y modificar solo de la propia organización
drop policy if exists "View Own Pending Orders" on public.pending_orders;
create policy "View Own Pending Orders" on public.pending_orders for select using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

drop policy if exists "Manage Own Pending Orders" on public.pending_orders;
create policy "Manage Own Pending Orders" on public.pending_orders for all using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

-- ==============================================================================
-- HABILITAR REALTIME PARA LAS NUEVAS TABLAS
-- ==============================================================================

do $$ 
begin
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'organization_settings') then
        alter publication supabase_realtime add table public.organization_settings;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cost_prices') then
        alter publication supabase_realtime add table public.cost_prices;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventory_history') then
        alter publication supabase_realtime add table public.inventory_history;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'waste_reports') then
        alter publication supabase_realtime add table public.waste_reports;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pending_orders') then
        alter publication supabase_realtime add table public.pending_orders;
    end if;
end $$;

-- Habilitar réplica completa para realtime
alter table public.organization_settings replica identity full;
alter table public.cost_prices replica identity full;
alter table public.inventory_history replica identity full;
alter table public.waste_reports replica identity full;
alter table public.pending_orders replica identity full;

-- ==============================================================================
-- ÍNDICES PARA MEJOR RENDIMIENTO
-- ==============================================================================

create index if not exists idx_organization_settings_org_id on public.organization_settings(organization_id);
create index if not exists idx_cost_prices_org_id on public.cost_prices(organization_id);
create index if not exists idx_inventory_history_org_id on public.inventory_history(organization_id);
create index if not exists idx_waste_reports_org_id on public.waste_reports(organization_id);
create index if not exists idx_pending_orders_org_id on public.pending_orders(organization_id);
create index if not exists idx_pending_orders_status on public.pending_orders(status);

-- ==============================================================================
-- CONFIRMACIÓN
-- ==============================================================================

select 'Sincronización completa configurada. Las siguientes tablas ahora sincronizan en tiempo real:
- organization_settings (moneda, tasas de cambio)
- cost_prices (precios de costo)
- inventory_history (historial de inventario)
- waste_reports (historial de merma)
- pending_orders (tickets abiertos)' as status;




25.



-- ==============================================================================
-- SETUP: Links de Activación de Un Solo Uso
-- Descripción: Añade soporte para generar links de activación que el usuario
-- puede visitar para activar su cuenta automáticamente.
-- ==============================================================================

-- 1. Añadir columnas para el token de activación en license_keys
alter table public.license_keys add column if not exists activation_token text unique;
alter table public.license_keys add column if not exists activation_token_expires_at timestamp with time zone;
alter table public.license_keys add column if not exists activated_at timestamp with time zone;
alter table public.license_keys add column if not exists activated_by_email text;

-- 2. Crear índice para búsquedas rápidas por token
create index if not exists idx_license_keys_activation_token on public.license_keys(activation_token);

-- 3. Confirmación
select 'Link de activación configurado. Los campos activation_token, activation_token_expires_at, activated_at, y activated_by_email fueron añadidos a license_keys.' as status;




26.



-- ==============================================================================
-- REFUERZO: OPTIMIZACIÓN DE SINCRONIZACIÓN Y SEGURIDAD
-- ==============================================================================

-- 1. Mejorar tablas de historial para que graben el usuario automáticamente
alter table public.inventory_history 
  alter column created_by set default auth.uid();

alter table public.waste_reports 
  alter column created_by set default auth.uid();

-- 2. Asegurar que las tablas de ventas tengan RLS configurado
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Políticas para Orders
drop policy if exists "Manage Own Orders" on public.orders;
create policy "Manage Own Orders" on public.orders for all using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
);

-- Políticas para Order Items (Basadas en la tabla padre 'orders')
drop policy if exists "Manage Own Order Items" on public.order_items;
create policy "Manage Own Order Items" on public.order_items for all using (
    order_id in (select id from public.orders)
);

-- 3. Habilitar Realtime para tablas de ventas (Opcional pero recomendado)
do $$ 
begin
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
        alter publication supabase_realtime add table public.orders;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'order_items') then
        alter publication supabase_realtime add table public.order_items;
    end if;
end $$;

-- 4. Asegurar Replica Identity Full para detectar cambios en Realtime
alter table public.orders replica identity full;
alter table public.order_items replica identity full;

-- Confirmación
select 'Base de datos optimizada para sincronización completa' as status;




27.



-- 1. Asegurar que los cambios se notifiquen con todo el detalle (necesario para sincronizar borrados)
alter table public.pending_orders replica identity full;
alter table public.orders replica identity full;

-- 2. Limpiar tickets viejos que quedaron como 'PAID' en la tabla de pendientes
-- (ahora los tickets cerrados se borran de aquí, así que esto limpia la "basura" anterior)
delete from public.pending_orders where status = 'PAID';

-- 3. Confirmar configuración de Realtime para otras tablas de forma segura
do $$ 
begin
    -- Solo añade la tabla si no está ya en la lista
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pending_orders') then
        alter publication supabase_realtime add table public.pending_orders;
    end if;
end $$;




28.




-- 1. Asegurar que la columna 'payments' existe en la tabla de ventas
-- Si la tabla no existe, la crea; si existe, le añade la columna faltante.
create table if not exists public.orders (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid not null,
    ticket_number integer not null,
    customer_name text default 'Anónimo',
    status text not null default 'PAID',
    type text default 'Llevar',
    payment_method text,
    reference text,
    total_amount_bs numeric(12, 2) not null default 0,
    total_amount_usd numeric(12, 2) not null default 0,
    payments jsonb default '[]',
    created_by text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    closed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Por si la tabla ya existía, forzamos la creación de la columna 'payments'
do $$ 
begin
    if not exists (select 1 from information_schema.columns where table_name='orders' and column_name='payments') then
        alter table public.orders add column payments jsonb default '[]';
    end if;
end $$;

-- 3. Asegurar que la tabla de detalles (order_items) esté correcta
create table if not exists public.order_items (
    id uuid default gen_random_uuid() primary key,
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id uuid, -- Puede ser NULL para consumos genéricos
    product_name text not null,
    quantity numeric(12, 2) not null default 1,
    price numeric(12, 2) not null default 0,
    emission text,
    subtype text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Refrescar los permisos de Realtime
alter table public.orders replica identity full;




29.



-- SCRIPT DE ACTUALIZACIÓN COMPLETA DE TABLA ORDERS
-- Este script agrega todas las columnas necesarias si no existen.

DO $$ 
BEGIN
    -- 1. Agregar organization_id (si no existe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='organization_id') THEN
        ALTER TABLE public.orders ADD COLUMN organization_id uuid;
    END IF;

    -- 2. Agregar ticket_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ticket_number') THEN
        ALTER TABLE public.orders ADD COLUMN ticket_number integer;
    END IF;

    -- 3. Agregar customer_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_name') THEN
        ALTER TABLE public.orders ADD COLUMN customer_name text DEFAULT 'Anónimo';
    END IF;

    -- 4. Agregar total_amount_bs (El que causó el último error)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_amount_bs') THEN
        ALTER TABLE public.orders ADD COLUMN total_amount_bs numeric(12, 2) DEFAULT 0;
    END IF;

    -- 5. Agregar total_amount_usd
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_amount_usd') THEN
        ALTER TABLE public.orders ADD COLUMN total_amount_usd numeric(12, 2) DEFAULT 0;
    END IF;

    -- 6. Agregar payments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payments') THEN
        ALTER TABLE public.orders ADD COLUMN payments jsonb DEFAULT '[]';
    END IF;

    -- 7. Agregar created_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='created_by') THEN
        ALTER TABLE public.orders ADD COLUMN created_by text;
    END IF;

    -- 8. Agregar closed_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='closed_at') THEN
        ALTER TABLE public.orders ADD COLUMN closed_at timestamp with time zone DEFAULT now();
    END IF;

    -- 9. Asegurar que 'type' existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='type') THEN
        ALTER TABLE public.orders ADD COLUMN type text DEFAULT 'Llevar';
    END IF;

    -- 10. Asegurar que 'payment_method' existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_method') THEN
        ALTER TABLE public.orders ADD COLUMN payment_method text;
    END IF;

    -- 11. Asegurar que 'reference' existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='reference') THEN
        ALTER TABLE public.orders ADD COLUMN reference text;
    END IF;

END $$;

-- Refrescar la identidad de la tabla para Realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;

SELECT 'Tabla de ventas actualizada con todas las columnas necesarias.' as resultado;





30.



-- REPARACIÓN AVANZADA: ELIMINAR CANDADOS (CONSTRAINTS) Y CAMBIAR TIPO
-- Esto quita la restricción de UUID para permitir correos electrónicos

DO $$ 
BEGIN
    -- 1. Quitar candado de la tabla 'orders' si existe
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_created_by_fkey') THEN
        ALTER TABLE public.orders DROP CONSTRAINT orders_created_by_fkey;
    END IF;

    -- 2. Quitar candado de la tabla 'pending_orders' si existe
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_orders_created_by_fkey') THEN
        ALTER TABLE public.pending_orders DROP CONSTRAINT pending_orders_created_by_fkey;
    END IF;

    -- 3. Ahora sí, cambiar el tipo de dato a TEXT en ambas tablas
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='created_by') THEN
        ALTER TABLE public.orders ALTER COLUMN created_by TYPE text;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_orders' AND column_name='created_by') THEN
        ALTER TABLE public.pending_orders ALTER COLUMN created_by TYPE text;
    END IF;

END $$;

-- 4. Asegurar que las otras columnas necesarias existan (pagos, etc)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount_bs numeric(12, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payments jsonb DEFAULT '[]';

SELECT 'Candados eliminados y tipos de datos actualizados correctamente.' as resultado;




31.




-- 1. Añadir columna de seguimiento a organizaciones
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;

-- 2. Actualizar RLS para permitir la inserción de la prueba
DROP POLICY IF EXISTS "Users can activate their own trial" ON public.license_keys;
CREATE POLICY "Users can activate their own trial" 
ON public.license_keys FOR INSERT 
TO authenticated 
WITH CHECK (
    LOWER(plan_type) = 'free' AND
    used_by_org_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- 3. Permitir actualización de la organización propia
DROP POLICY IF EXISTS "Users can update their own organization" ON public.organizations;
CREATE POLICY "Users can update their own organization" 
ON public.organizations FOR UPDATE 
TO authenticated 
USING (
    id IN (
        SELECT organization_id FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('master', 'admin')
    )
)
WITH CHECK (
    id IN (
        SELECT organization_id FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('master', 'admin')
    )
);




32.



-- Add trial_dismissed_until column to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS trial_dismissed_until TIMESTAMPTZ;




33.



-- Cambiar el tipo de dato de ticket_number de entero a texto
-- para permitir códigos alfanuméricos como "A1B2C3"

-- 1. Alterar tabla 'orders' (Ventas Finalizadas)
ALTER TABLE public.orders 
ALTER COLUMN ticket_number TYPE text USING ticket_number::text;

-- 2. Alterar tabla 'pending_orders' (Tickets Abiertos)
ALTER TABLE public.pending_orders 
ALTER COLUMN ticket_number TYPE text USING ticket_number::text;



34.



-- 1. Crear la tabla de invitaciones si no existe
CREATE TABLE IF NOT EXISTS public.organization_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'EMPLOYEE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT organization_invites_unique UNIQUE(email, organization_id)
);

-- 2. Habilitar seguridad (RLS)
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- 3. Política para que los dueños puedan gestionar invitaciones
DROP POLICY IF EXISTS "Owners can manage invites" ON public.organization_invites;
CREATE POLICY "Owners can manage invites" ON public.organization_invites
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND (role IN ('master', 'owner', 'admin', 'manager', 'developer', 'OWNER', 'ADMIN', 'MANAGER', 'DEVELOPER'))
            AND organization_id = public.organization_invites.organization_id
        )
    );

-- 4. Hacer que el disparador de perfiles sea más resistente
-- Esto evita el error "Database error saving new user" si faltan metadatos
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'), 
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'EMPLOYEE')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;




35.



-- Asegurar que la columna email existe y está sincronizada en profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- Sincronizar correos faltantes desde el sistema de Auth
UPDATE public.profiles
SET email = auth.users.email
FROM auth.users
WHERE public.profiles.id = auth.users.id
AND public.profiles.email IS NULL;

-- Trigger para que futuros usuarios se sincronicen automáticamente
CREATE OR REPLACE FUNCTION public.handle_user_email_sync() 
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles 
  SET email = new.email 
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_email ON auth.users;
CREATE TRIGGER tr_sync_email
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_email_sync();





36.





-- Dar permiso a los usuarios para ver y crear su propio perfil
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);



37.




-- 1. Eliminamos la restricción antigua para actualizarla
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Creamos la nueva regla que acepta todos los roles que usamos en la app
-- (Incluimos ambos formatos por seguridad)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN (
    'OWNER', 'MANAGER', 'EMPLOYEE', 'DEVELOPER', 
    'owner', 'manager', 'employee', 'developer', 'master', 'admin'
));

-- 3. Por si acaso, nos aseguramos de que el disparador de nuevos usuarios sea robusto
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'), 
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'EMPLOYEE')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;




38.




-- ====================================================================
-- FIX: Deshabilitar confirmación de email y permitir registro directo
-- ====================================================================
-- Este script soluciona el problema de registro cuando Supabase no envía
-- correos de confirmación.
-- 
-- IMPORTANTE: Ejecuta este código en el SQL Editor de Supabase
-- ====================================================================

-- 1. DESHABILITAR CONFIRMACIÓN DE EMAIL
-- Esto permite que los usuarios se registren sin necesidad de confirmar email
-- NOTA: Esto se debe hacer en el Dashboard de Supabase:
-- Authentication > Providers > Email > Desactivar "Confirm email"

-- 2. VERIFICAR QUE LAS TABLAS EXISTEN
DO $$
BEGIN
    -- Verificar que la tabla profiles existe
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        RAISE EXCEPTION 'La tabla profiles no existe. Ejecuta primero el schema completo.';
    END IF;
    
    -- Verificar que la tabla organizations existe
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organizations') THEN
        RAISE EXCEPTION 'La tabla organizations no existe. Ejecuta primero el schema completo.';
    END IF;
END $$;

-- 3. RECREAR TRIGGER PARA AUTO-CREAR PROFILES
-- Este trigger crea automáticamente un perfil cuando un usuario se registra

-- Eliminar el trigger existente si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Crear la función del trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_liquor_store_name TEXT;
BEGIN
    -- Obtener el nombre de la licorería de los metadatos (si existe)
    v_liquor_store_name := NEW.raw_user_meta_data->>'liquor_store_name';

    -- Si el usuario es dueño (tiene liquor_store_name), crear organización
    IF v_liquor_store_name IS NOT NULL AND v_liquor_store_name != '' THEN
        -- Crear la organización
        INSERT INTO public.organizations (name)
        VALUES (v_liquor_store_name)
        RETURNING id INTO v_org_id;

        -- Crear perfil como MASTER
        INSERT INTO public.profiles (
            id,
            full_name,
            role,
            organization_id
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            'master',
            v_org_id
        );
    ELSE
        -- Crear perfil normal (sin organización)
        INSERT INTO public.profiles (
            id,
            full_name,
            role,
            organization_id
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            'user',
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. ASEGURAR POLÍTICAS RLS PARA PERMITIR INSERCIONES
-- Políticas para la tabla profiles

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Permitir la creación de perfiles durante el registro
CREATE POLICY "Allow profile creation during signup"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- El service role puede hacer todo
CREATE POLICY "Service role can manage all profiles"
    ON public.profiles
    USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role');

-- 5. POLÍTICAS PARA LA TABLA ORGANIZATIONS

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Masters can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Allow organization creation" ON public.organizations;

-- Habilitar RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver su organización
CREATE POLICY "Users can view their organization"
    ON public.organizations
    FOR SELECT
    USING (
        id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Los masters pueden actualizar su organización
CREATE POLICY "Masters can update their organization"
    ON public.organizations
    FOR UPDATE
    USING (
        id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE id = auth.uid() AND role = 'master'
        )
    );

-- Permitir creación de organizaciones (necesario para el trigger)
CREATE POLICY "Allow organization creation"
    ON public.organizations
    FOR INSERT
    WITH CHECK (true);

-- 6. FUNCIÓN PARA VERIFICAR ESTADO
CREATE OR REPLACE FUNCTION public.debug_auth_status()
RETURNS TABLE (
    total_users BIGINT,
    confirmed_users BIGINT,
    pending_users BIGINT,
    total_profiles BIGINT,
    total_organizations BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM auth.users),
        (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
        (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL),
        (SELECT COUNT(*) FROM public.profiles),
        (SELECT COUNT(*) FROM public.organizations);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. VERIFICAR ESTADO ACTUAL
SELECT * FROM public.debug_auth_status();

-- ====================================================================
-- INSTRUCCIONES ADICIONALES:
-- ====================================================================
-- 
-- 1. Ve al Dashboard de Supabase
-- 2. Authentication > Providers > Email
-- 3. DESACTIVA la opción "Confirm email"
-- 4. Guarda los cambios
-- 
-- Esto permitirá que los usuarios se registren inmediatamente sin 
-- necesidad de confirmar su email.
-- 
-- Para PRODUCCIÓN, considera configurar un proveedor SMTP en:
-- Project Settings > Auth > SMTP Settings
-- ====================================================================

-- OPCIONAL: Confirmar manualmente usuarios existentes que quedaron pendientes
-- Descomenta las siguientes líneas si tienes usuarios que no se confirmaron:
/*
UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
*/

-- OPCIONAL: Ver usuarios pendientes de confirmación
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    raw_user_meta_data->>'full_name' as full_name
FROM auth.users
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC;





39.




-- ====================================================================
-- SISTEMA DE PRUEBA GRATUITA DE 7 DÍAS
-- ====================================================================
-- Este script habilita un trial de 7 días automático para todas las 
-- nuevas organizaciones sin necesidad de ingresar una licencia.
-- ====================================================================

-- 1. AGREGAR COLUMNA PARA RASTREAR SI YA USARON EL TRIAL
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- 2. FUNCIÓN HELPER PARA VERIFICAR SI EL TRIAL ESTÁ ACTIVO
CREATE OR REPLACE FUNCTION public.is_trial_active(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    org_record RECORD;
    trial_end_date TIMESTAMPTZ;
BEGIN
    -- Obtener información de la organización
    SELECT 
        trial_started_at,
        is_active,
        license_expires_at,
        plan_type
    INTO org_record
    FROM public.organizations
    WHERE id = org_id;

    -- Si no existe la organización, retornar false
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Si ya tiene una licencia activa, no necesita trial
    IF org_record.is_active = TRUE THEN
        -- Verificar si no está expirada
        IF org_record.license_expires_at IS NULL OR org_record.license_expires_at > NOW() THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Si tiene trial_started_at, verificar si aún está dentro de los 7 días
    IF org_record.trial_started_at IS NOT NULL THEN
        trial_end_date := org_record.trial_started_at + INTERVAL '7 days';
        IF NOW() < trial_end_date THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- En cualquier otro caso, no tiene acceso
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ACTUALIZAR EL TRIGGER DE CREACIÓN DE USUARIO PARA INCLUIR TRIAL
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_liquor_store_name TEXT;
BEGIN
    -- Obtener el nombre de la licorería de los metadatos (si existe)
    v_liquor_store_name := NEW.raw_user_meta_data->>'liquor_store_name';

    -- Si el usuario es dueño (tiene liquor_store_name), crear organización
    IF v_liquor_store_name IS NOT NULL AND v_liquor_store_name != '' THEN
        -- Crear la organización CON TRIAL DE 7 DÍAS ACTIVADO
        INSERT INTO public.organizations (
            name,
            trial_started_at,  -- ⭐ IMPORTANTE: Iniciar el trial automáticamente
            is_active,
            plan_type
        ) VALUES (
            v_liquor_store_name,
            NOW(),  -- ⭐ Iniciar trial inmediatamente
            FALSE,  -- No tienen licencia aún
            NULL    -- Sin plan hasta que activen
        )
        RETURNING id INTO v_org_id;

        -- Crear perfil como MASTER
        INSERT INTO public.profiles (
            id,
            full_name,
            role,
            organization_id
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            'master',
            v_org_id
        );
    ELSE
        -- Crear perfil normal (sin organización, sin trial)
        INSERT INTO public.profiles (
            id,
            full_name,
            role,
            organization_id
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            'user',
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. ACTUALIZAR ORGANIZACIONES EXISTENTES QUE NO TIENEN LICENCIA
-- Darles trial a organizaciones que fueron creadas pero no tienen licencia activa
UPDATE public.organizations
SET trial_started_at = created_at
WHERE trial_started_at IS NULL
  AND is_active = FALSE
  AND created_at > NOW() - INTERVAL '7 days'; -- Solo las recientes (últimos 7 días)

-- 5. FUNCIÓN PARA OBTENER INFO DEL TRIAL (útil para el frontend)
CREATE OR REPLACE FUNCTION public.get_trial_info(org_id UUID)
RETURNS TABLE (
    has_trial BOOLEAN,
    trial_active BOOLEAN,
    trial_started TIMESTAMPTZ,
    trial_ends TIMESTAMPTZ,
    days_remaining INTEGER
) AS $$
DECLARE
    org_record RECORD;
    trial_end_date TIMESTAMPTZ;
BEGIN
    -- Obtener información de la organización
    SELECT 
        trial_started_at,
        is_active
    INTO org_record
    FROM public.organizations
    WHERE id = org_id;

    -- Si no existe, retornar valores nulos
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, 0;
        RETURN;
    END IF;

    -- Si tiene trial iniciado
    IF org_record.trial_started_at IS NOT NULL THEN
        trial_end_date := org_record.trial_started_at + INTERVAL '7 days';
        
        RETURN QUERY SELECT 
            TRUE,
            (NOW() < trial_end_date AND org_record.is_active = FALSE),
            org_record.trial_started_at,
            trial_end_date,
            GREATEST(0, EXTRACT(DAY FROM (trial_end_date - NOW()))::INTEGER);
    ELSE
        -- No tiene trial
        RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. AGREGAR RPC PARA QUE EL FRONTEND PUEDA VERIFICAR EL TRIAL
-- Esto se puede llamar desde React con: supabase.rpc('check_trial_status')
CREATE OR REPLACE FUNCTION public.check_trial_status()
RETURNS JSON AS $$
DECLARE
    v_org_id UUID;
    v_trial_info RECORD;
    result JSON;
BEGIN
    -- Obtener organization_id del usuario actual
    SELECT organization_id INTO v_org_id
    FROM public.profiles
    WHERE id = auth.uid();

    -- Si no tiene organización, no tiene trial
    IF v_org_id IS NULL THEN
        RETURN json_build_object(
            'hasTrial', FALSE,
            'isTrialActive', FALSE,
            'daysRemaining', 0
        );
    END IF;

    -- Obtener info del trial
    SELECT * INTO v_trial_info
    FROM public.get_trial_info(v_org_id);

    RETURN json_build_object(
        'hasTrial', v_trial_info.has_trial,
        'isTrialActive', v_trial_info.trial_active,
        'trialStarted', v_trial_info.trial_started,
        'trialEnds', v_trial_info.trial_ends,
        'daysRemaining', v_trial_info.days_remaining
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- VERIFICACIÓN: VER ORGANIZACIONES CON TRIAL
-- ====================================================================
SELECT 
    o.id,
    o.name,
    o.trial_started_at,
    o.trial_started_at + INTERVAL '7 days' as trial_ends_at,
    CASE 
        WHEN o.trial_started_at IS NULL THEN 'Sin Trial'
        WHEN NOW() < (o.trial_started_at + INTERVAL '7 days') THEN 'Trial Activo'
        ELSE 'Trial Expirado'
    END as trial_status,
    CASE 
        WHEN o.is_active = TRUE THEN 'Con Licencia'
        ELSE 'Sin Licencia'
    END as license_status,
    EXTRACT(DAY FROM ((o.trial_started_at + INTERVAL '7 days') - NOW()))::INTEGER as days_remaining
FROM public.organizations o
ORDER BY o.created_at DESC
LIMIT 20;

-- ====================================================================
-- INSTRUCCIONES:
-- ====================================================================
-- 
-- 1. Ejecuta este script en el SQL Editor de Supabase
-- 2. Después, actualiza el AuthContext.jsx en el frontend para usar
--    la función is_trial_active() al verificar permisos
-- 3. Las nuevas organizaciones automáticamente tendrán 7 días de prueba
-- 4. Puedes verificar el estado con: SELECT * FROM check_trial_status();
-- 
-- ====================================================================





40.




-- ====================================================================
-- SISTEMA DE PRUEBA GRATUITA DE 7 DÍAS
-- ====================================================================
-- Este script habilita un trial de 7 días automático para todas las 
-- nuevas organizaciones sin necesidad de ingresar una licencia.
-- ====================================================================

-- 1. AGREGAR COLUMNA PARA RASTREAR SI YA USARON EL TRIAL
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- 2. FUNCIÓN HELPER PARA VERIFICAR SI EL TRIAL ESTÁ ACTIVO
CREATE OR REPLACE FUNCTION public.is_trial_active(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    org_record RECORD;
    trial_end_date TIMESTAMPTZ;
BEGIN
    -- Obtener información de la organización
    SELECT 
        trial_started_at,
        is_active,
        license_expires_at,
        plan_type
    INTO org_record
    FROM public.organizations
    WHERE id = org_id;

    -- Si no existe la organización, retornar false
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Si ya tiene una licencia activa, no necesita trial
    IF org_record.is_active = TRUE THEN
        -- Verificar si no está expirada
        IF org_record.license_expires_at IS NULL OR org_record.license_expires_at > NOW() THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Si tiene trial_started_at, verificar si aún está dentro de los 7 días
    IF org_record.trial_started_at IS NOT NULL THEN
        trial_end_date := org_record.trial_started_at + INTERVAL '7 days';
        IF NOW() < trial_end_date THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- En cualquier otro caso, no tiene acceso
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ACTUALIZAR EL TRIGGER DE CREACIÓN DE USUARIO PARA INCLUIR TRIAL
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_liquor_store_name TEXT;
BEGIN
    -- Obtener el nombre de la licorería de los metadatos (si existe)
    v_liquor_store_name := NEW.raw_user_meta_data->>'liquor_store_name';

    -- Si el usuario es dueño (tiene liquor_store_name), crear organización
    IF v_liquor_store_name IS NOT NULL AND v_liquor_store_name != '' THEN
        -- Crear la organización SIN activar el trial automáticamente
        -- El trial se activará cuando el usuario presione el botón "Probar 7 Días"
        INSERT INTO public.organizations (
            name,
            trial_started_at,  -- NULL por defecto
            is_active,
            plan_type
        ) VALUES (
            v_liquor_store_name,
            NULL,   -- ⭐ NO activar trial automáticamente
            FALSE,  -- No tienen licencia aún
            NULL    -- Sin plan hasta que activen
        )
        RETURNING id INTO v_org_id;

        -- Crear perfil como MASTER
        INSERT INTO public.profiles (
            id,
            full_name,
            role,
            organization_id
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            'master',
            v_org_id
        );
    ELSE
        -- Crear perfil normal (sin organización, sin trial)
        INSERT INTO public.profiles (
            id,
            full_name,
            role,
            organization_id
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            'user',
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. NO ACTUALIZAR organizaciones existentes automáticamente
-- El trial debe activarse manualmente presionando el botón "Probar 7 Días"
-- Si quieres dar trial a organizaciones específicas, hazlo manualmente con:
-- UPDATE public.organizations
-- SET trial_started_at = NOW()
-- WHERE id = 'organization_id_here';

-- 5. FUNCIÓN PARA OBTENER INFO DEL TRIAL (útil para el frontend)
CREATE OR REPLACE FUNCTION public.get_trial_info(org_id UUID)
RETURNS TABLE (
    has_trial BOOLEAN,
    trial_active BOOLEAN,
    trial_started TIMESTAMPTZ,
    trial_ends TIMESTAMPTZ,
    days_remaining INTEGER
) AS $$
DECLARE
    org_record RECORD;
    trial_end_date TIMESTAMPTZ;
BEGIN
    -- Obtener información de la organización
    SELECT 
        trial_started_at,
        is_active
    INTO org_record
    FROM public.organizations
    WHERE id = org_id;

    -- Si no existe, retornar valores nulos
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, 0;
        RETURN;
    END IF;

    -- Si tiene trial iniciado
    IF org_record.trial_started_at IS NOT NULL THEN
        trial_end_date := org_record.trial_started_at + INTERVAL '7 days';
        
        RETURN QUERY SELECT 
            TRUE,
            (NOW() < trial_end_date AND org_record.is_active = FALSE),
            org_record.trial_started_at,
            trial_end_date,
            GREATEST(0, EXTRACT(DAY FROM (trial_end_date - NOW()))::INTEGER);
    ELSE
        -- No tiene trial
        RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. AGREGAR RPC PARA QUE EL FRONTEND PUEDA VERIFICAR EL TRIAL
-- Esto se puede llamar desde React con: supabase.rpc('check_trial_status')
CREATE OR REPLACE FUNCTION public.check_trial_status()
RETURNS JSON AS $$
DECLARE
    v_org_id UUID;
    v_trial_info RECORD;
    result JSON;
BEGIN
    -- Obtener organization_id del usuario actual
    SELECT organization_id INTO v_org_id
    FROM public.profiles
    WHERE id = auth.uid();

    -- Si no tiene organización, no tiene trial
    IF v_org_id IS NULL THEN
        RETURN json_build_object(
            'hasTrial', FALSE,
            'isTrialActive', FALSE,
            'daysRemaining', 0
        );
    END IF;

    -- Obtener info del trial
    SELECT * INTO v_trial_info
    FROM public.get_trial_info(v_org_id);

    RETURN json_build_object(
        'hasTrial', v_trial_info.has_trial,
        'isTrialActive', v_trial_info.trial_active,
        'trialStarted', v_trial_info.trial_started,
        'trialEnds', v_trial_info.trial_ends,
        'daysRemaining', v_trial_info.days_remaining
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- VERIFICACIÓN: VER ORGANIZACIONES CON TRIAL
-- ====================================================================
SELECT 
    o.id,
    o.name,
    o.trial_started_at,
    o.trial_started_at + INTERVAL '7 days' as trial_ends_at,
    CASE 
        WHEN o.trial_started_at IS NULL THEN 'Sin Trial'
        WHEN NOW() < (o.trial_started_at + INTERVAL '7 days') THEN 'Trial Activo'
        ELSE 'Trial Expirado'
    END as trial_status,
    CASE 
        WHEN o.is_active = TRUE THEN 'Con Licencia'
        ELSE 'Sin Licencia'
    END as license_status,
    EXTRACT(DAY FROM ((o.trial_started_at + INTERVAL '7 days') - NOW()))::INTEGER as days_remaining
FROM public.organizations o
ORDER BY o.created_at DESC
LIMIT 20;

-- ====================================================================
-- INSTRUCCIONES:
-- ====================================================================
-- 
-- 1. Ejecuta este script en el SQL Editor de Supabase
-- 2. El trial NO se activa automáticamente
-- 3. El usuario debe presionar el botón "Probar 7 Días" en el banner
-- 4. El botón ejecuta: UPDATE organizations SET trial_started_at = NOW()
-- 5. Los developers verán el trial activo en la tabla de licencias
-- 6. Puedes verificar el estado con: SELECT * FROM check_trial_status();
-- 
-- ====================================================================





