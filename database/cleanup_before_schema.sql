-- ====================================================================
-- SCRIPT DE LIMPIEZA ANTES DE APLICAR MASTER SCHEMA
-- ====================================================================
-- Ejecuta este script ANTES de master_schema.sql si ya tienes datos
-- Esto elimina políticas duplicadas y prepara la base de datos
-- ====================================================================

-- ===========================================
-- ELIMINAR POLÍTICAS EXISTENTES
-- ===========================================

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Organizations
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Masters can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Allow organization creation" ON public.organizations;
DROP POLICY IF EXISTS "Developers can view all organizations" ON public.organizations;

-- Products
DROP POLICY IF EXISTS "View own org products" ON public.products;
DROP POLICY IF EXISTS "Manage own org products" ON public.products;

-- Emission Types
DROP POLICY IF EXISTS "View own emissions" ON public.emission_types;
DROP POLICY IF EXISTS "Manage own emissions" ON public.emission_types;

-- Inventory
DROP POLICY IF EXISTS "View own inventory" ON public.inventory;
DROP POLICY IF EXISTS "Manage own inventory" ON public.inventory;

-- Prices
DROP POLICY IF EXISTS "View own prices" ON public.prices;
DROP POLICY IF EXISTS "Manage own prices" ON public.prices;

-- Cost Prices
DROP POLICY IF EXISTS "View own costs" ON public.cost_prices;
DROP POLICY IF EXISTS "Manage own costs" ON public.cost_prices;

-- Orders
DROP POLICY IF EXISTS "Manage own orders" ON public.orders;
DROP POLICY IF EXISTS "Manage own order items" ON public.order_items;

-- Pending Orders
DROP POLICY IF EXISTS "View own pending orders" ON public.pending_orders;
DROP POLICY IF EXISTS "Manage own pending orders" ON public.pending_orders;

-- License Keys
DROP POLICY IF EXISTS "Anyone authenticated can read available keys" ON public.license_keys;
DROP POLICY IF EXISTS "Developers can manage license keys" ON public.license_keys;
DROP POLICY IF EXISTS "Users can activate available keys" ON public.license_keys;

-- Organization Invites
DROP POLICY IF EXISTS "Managers can manage invites" ON public.organization_invites;

-- Settings
DROP POLICY IF EXISTS "View own settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Manage own settings" ON public.organization_settings;

-- Inventory History
DROP POLICY IF EXISTS "View own inventory history" ON public.inventory_history;
DROP POLICY IF EXISTS "Manage own inventory history" ON public.inventory_history;

-- Waste Reports
DROP POLICY IF EXISTS "View own waste reports" ON public.waste_reports;
DROP POLICY IF EXISTS "Manage own waste reports" ON public.waste_reports;

-- Analytics
DROP POLICY IF EXISTS "Users can insert own events" ON public.analytics_events;
DROP POLICY IF EXISTS "Developers can view all events" ON public.analytics_events;

-- ===========================================
-- ELIMINAR FUNCIONES EXISTENTES
-- ===========================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_email_sync() CASCADE;
DROP FUNCTION IF EXISTS public.protect_license_keys() CASCADE;
DROP FUNCTION IF EXISTS public.is_trial_active(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_trial_info(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_trial_status() CASCADE;

-- ===========================================
-- MENSAJE
-- ===========================================

SELECT '✅ Limpieza completada. Ahora puedes ejecutar master_schema.sql' as status;
