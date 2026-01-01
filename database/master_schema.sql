-- ====================================================================
-- KAVAS APP - MASTER DATABASE SCHEMA
-- ====================================================================
-- Version: 2.0 (Consolidated from 40 migrations)
-- Created: 2025-12-31
-- Description: Clean, optimized schema for Kavas liquor store app
-- ====================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- CORE TABLES
-- ====================================================================

-- 1. Organizations (liquor stores)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    
    -- License management
    license_key TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    plan_type TEXT DEFAULT NULL,
    license_activated_at TIMESTAMPTZ,
    license_expires_at TIMESTAMPTZ,
    
    -- Trial system (manual activation)
    trial_started_at TIMESTAMPTZ DEFAULT NULL,
    trial_dismissed_until TIMESTAMPTZ,
    has_used_trial BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'employee',
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    
    -- Role constraint (lowercase only for consistency)
    CONSTRAINT profiles_role_check CHECK (
        role IN ('master', 'owner', 'manager', 'employee', 'developer', 'user', 'admin')
    )
);

-- 3. Products (beer types)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    format TEXT DEFAULT 'Botella',
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT products_unique UNIQUE(organization_id, name)
);

-- 4. Emission Types (container conversions)
CREATE TABLE IF NOT EXISTS public.emission_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subtype TEXT,
    units INTEGER NOT NULL DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT emission_types_unique UNIQUE(organization_id, name, subtype)
);

-- 5. Inventory
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    subtype TEXT NOT NULL,
    quantity NUMERIC DEFAULT 0,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT inventory_unique UNIQUE(product_id, subtype)
);

-- 6. Prices
CREATE TABLE IF NOT EXISTS public.prices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    emission TEXT NOT NULL,
    subtype TEXT NOT NULL,
    price NUMERIC DEFAULT 0,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    is_local BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT prices_unique UNIQUE(product_id, emission, subtype, is_local)
);

-- 7. Cost Prices
CREATE TABLE IF NOT EXISTS public.cost_prices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    emission TEXT NOT NULL,
    subtype TEXT NOT NULL,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT cost_prices_unique UNIQUE(organization_id, product_id, emission, subtype)
);

-- 8. Orders (completed sales)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    ticket_number TEXT NOT NULL,
    customer_name TEXT DEFAULT 'Anónimo',
    status TEXT NOT NULL DEFAULT 'PAID',
    type TEXT DEFAULT 'Llevar',
    payment_method TEXT,
    reference TEXT,
    total_amount_bs NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payments JSONB DEFAULT '[]',
    created_by TEXT,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    emission TEXT,
    subtype TEXT,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Pending Orders (open tickets)
CREATE TABLE IF NOT EXISTS public.pending_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    ticket_number TEXT NOT NULL,
    customer_name TEXT DEFAULT 'Cliente',
    status TEXT NOT NULL DEFAULT 'OPEN',
    type TEXT DEFAULT 'Local',
    payment_method TEXT,
    reference TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    payments JSONB DEFAULT '[]',
    created_by TEXT,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- LICENSE SYSTEM TABLES
-- ====================================================================

-- 11. License Keys
CREATE TABLE IF NOT EXISTS public.license_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    plan_type TEXT DEFAULT 'monthly',
    status TEXT DEFAULT 'available',
    
    -- Standard activation
    used_by_org_id UUID REFERENCES public.organizations(id),
    used_at TIMESTAMPTZ,
    
    -- One-click activation link
    activation_token TEXT UNIQUE,
    activation_token_expires_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    activated_by_email TEXT,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Organization Invites
CREATE TABLE IF NOT EXISTS public.organization_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'EMPLOYEE',
    status TEXT DEFAULT 'pending',
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT organization_invites_unique UNIQUE(email, organization_id)
);

-- ====================================================================
-- SYNC & TRACKING TABLES
-- ====================================================================

-- 13. Organization Settings
CREATE TABLE IF NOT EXISTS public.organization_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT organization_settings_unique UNIQUE(organization_id, key)
);

-- 14. Inventory History
CREATE TABLE IF NOT EXISTS public.inventory_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    movements JSONB NOT NULL DEFAULT '[]',
    total_units INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. Waste Reports
CREATE TABLE IF NOT EXISTS public.waste_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    movements JSONB NOT NULL DEFAULT '[]',
    total_units INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. Analytics Events
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    path TEXT,
    element_id TEXT,
    element_text TEXT,
    x INTEGER,
    y INTEGER,
    viewport_w INTEGER,
    viewport_h INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- INDEXES FOR PERFORMANCE
-- ====================================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(organization_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_org_id ON public.inventory(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON public.inventory(product_id);

-- Prices
CREATE INDEX IF NOT EXISTS idx_prices_org_id ON public.prices(organization_id);
CREATE INDEX IF NOT EXISTS idx_prices_product_id ON public.prices(product_id);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_org_id ON public.orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Pending Orders
CREATE INDEX IF NOT EXISTS idx_pending_orders_org_id ON public.pending_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON public.pending_orders(status);

-- License Keys
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON public.license_keys(status);
CREATE INDEX IF NOT EXISTS idx_license_keys_activation_token ON public.license_keys(activation_token);

-- Emission Types
CREATE INDEX IF NOT EXISTS idx_emission_types_org_id ON public.emission_types(organization_id);

-- Settings & History
CREATE INDEX IF NOT EXISTS idx_organization_settings_org_id ON public.organization_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_cost_prices_org_id ON public.cost_prices(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_org_id ON public.inventory_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_waste_reports_org_id ON public.waste_reports(organization_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- RLS POLICIES - PROFILES
-- ====================================================================

CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- ====================================================================
-- RLS POLICIES - ORGANIZATIONS
-- ====================================================================

CREATE POLICY "Users can view their organization" 
    ON public.organizations FOR SELECT 
    USING (
        id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Masters can update their organization" 
    ON public.organizations FOR UPDATE 
    USING (
        id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid() AND LOWER(role) IN ('master', 'owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Allow organization creation" 
    ON public.organizations FOR INSERT 
    WITH CHECK (true);

-- Developers can view all organizations (for DevTools)
CREATE POLICY "Developers can view all organizations" 
    ON public.organizations FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND LOWER(role) = 'developer'
        )
    );

-- ====================================================================
-- RLS POLICIES - PRODUCTS, INVENTORY, PRICES, EMISSIONS
-- ====================================================================

-- Products
CREATE POLICY "View own org products" ON public.products FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Manage own org products" ON public.products FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Emission Types
CREATE POLICY "View own emissions" ON public.emission_types FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Manage own emissions" ON public.emission_types FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Inventory
CREATE POLICY "View own inventory" ON public.inventory FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Manage own inventory" ON public.inventory FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Prices
CREATE POLICY "View own prices" ON public.prices FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Manage own prices" ON public.prices FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Cost Prices
CREATE POLICY "View own costs" ON public.cost_prices FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Manage own costs" ON public.cost_prices FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- ====================================================================
-- RLS POLICIES - ORDERS
-- ====================================================================

CREATE POLICY "Manage own orders" ON public.orders FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Manage own order items" ON public.order_items FOR ALL 
    USING (order_id IN (SELECT id FROM public.orders));

CREATE POLICY "View own pending orders" ON public.pending_orders FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Manage own pending orders" ON public.pending_orders FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- ====================================================================
-- RLS POLICIES - LICENSE SYSTEM
-- ====================================================================

-- License Keys - Reading
CREATE POLICY "Anyone authenticated can read available keys" 
    ON public.license_keys FOR SELECT 
    USING (
        status = 'available' 
        OR used_by_org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND LOWER(role) = 'developer')
    );

-- License Keys - Management (Developers only)
CREATE POLICY "Developers can manage license keys" 
    ON public.license_keys FOR ALL 
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

-- License Keys - Activation by users
CREATE POLICY "Users can activate available keys" 
    ON public.license_keys FOR UPDATE 
    USING (status = 'available')
    WITH CHECK (status = 'used');

-- Organization Invites
CREATE POLICY "Managers can manage invites" 
    ON public.organization_invites FOR ALL 
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid() 
            AND LOWER(role) IN ('master', 'owner', 'admin', 'manager', 'developer')
        )
    );

-- ====================================================================
-- RLS POLICIES - SETTINGS & TRACKING
-- ====================================================================

CREATE POLICY "View own settings" ON public.organization_settings FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Manage own settings" ON public.organization_settings FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "View own inventory history" ON public.inventory_history FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Manage own inventory history" ON public.inventory_history FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "View own waste reports" ON public.waste_reports FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Manage own waste reports" ON public.waste_reports FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- ====================================================================
-- RLS POLICIES - ANALYTICS
-- ====================================================================

CREATE POLICY "Users can insert own events" 
    ON public.analytics_events FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Developers can view all events" 
    ON public.analytics_events FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND LOWER(role) = 'developer'
        )
    );

-- ====================================================================
-- FUNCTIONS & TRIGGERS
-- ====================================================================

-- Function: Auto-create profile on user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_liquor_store_name TEXT;
BEGIN
    -- Extract liquor store name from metadata
    v_liquor_store_name := NEW.raw_user_meta_data->>'liquor_store_name';

    -- CASE A: Owner (has liquor_store_name)
    IF v_liquor_store_name IS NOT NULL AND v_liquor_store_name != '' THEN
        -- Create organization WITHOUT trial (manual activation via button)
        INSERT INTO public.organizations (name, trial_started_at, is_active, plan_type)
        VALUES (v_liquor_store_name, NULL, FALSE, NULL)
        RETURNING id INTO v_org_id;

        -- Create master profile
        INSERT INTO public.profiles (id, full_name, email, role, organization_id)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
            NEW.email,
            'master',
            v_org_id
        );
    
    -- CASE B: Employee (no liquor_store_name)
    ELSE
        INSERT INTO public.profiles (id, full_name, email, role, organization_id)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Execute on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function: Sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION public.handle_user_email_sync()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles 
    SET email = NEW.email 
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Keep email in sync
DROP TRIGGER IF EXISTS tr_sync_email ON auth.users;
CREATE TRIGGER tr_sync_email
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_email_sync();

-- Function: Protect used license keys
CREATE OR REPLACE FUNCTION protect_license_keys()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'used' AND NEW.status = 'used' AND OLD.used_by_org_id IS NOT NULL THEN
        RAISE EXCEPTION 'Esta licencia ya fue utilizada y no puede ser modificada.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_license_keys ON public.license_keys;
CREATE TRIGGER tr_protect_license_keys
    BEFORE UPDATE ON public.license_keys
    FOR EACH ROW
    EXECUTE FUNCTION protect_license_keys();

-- ====================================================================
-- TRIAL SYSTEM FUNCTIONS
-- ====================================================================

-- Function: Check if trial is active
CREATE OR REPLACE FUNCTION public.is_trial_active(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    org_record RECORD;
    trial_end_date TIMESTAMPTZ;
BEGIN
    SELECT trial_started_at, is_active, license_expires_at, plan_type
    INTO org_record
    FROM public.organizations
    WHERE id = org_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Active license takes precedence
    IF org_record.is_active = TRUE THEN
        IF org_record.license_expires_at IS NULL OR org_record.license_expires_at > NOW() THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Check trial
    IF org_record.trial_started_at IS NOT NULL THEN
        trial_end_date := org_record.trial_started_at + INTERVAL '7 days';
        IF NOW() < trial_end_date THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get trial info
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
    SELECT trial_started_at, is_active
    INTO org_record
    FROM public.organizations
    WHERE id = org_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, 0;
        RETURN;
    END IF;

    IF org_record.trial_started_at IS NOT NULL THEN
        trial_end_date := org_record.trial_started_at + INTERVAL '7 days';
        
        RETURN QUERY SELECT 
            TRUE,
            (NOW() < trial_end_date AND org_record.is_active = FALSE),
            org_record.trial_started_at,
            trial_end_date,
            GREATEST(0, EXTRACT(DAY FROM (trial_end_date - NOW()))::INTEGER);
    ELSE
        RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: RPC for frontend trial status check
CREATE OR REPLACE FUNCTION public.check_trial_status()
RETURNS JSON AS $$
DECLARE
    v_org_id UUID;
    v_trial_info RECORD;
BEGIN
    SELECT organization_id INTO v_org_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_org_id IS NULL THEN
        RETURN json_build_object(
            'hasTrial', FALSE,
            'isTrialActive', FALSE,
            'daysRemaining', 0
        );
    END IF;

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
-- REALTIME CONFIGURATION
-- ====================================================================

-- Enable realtime for key tables
DO $$ 
BEGIN
    -- Products
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'products') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;

    -- Inventory
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'inventory') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
    END IF;

    -- Prices
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'prices') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.prices;
    END IF;

    -- Emission Types
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'emission_types') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.emission_types;
    END IF;

    -- Orders
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    -- Pending Orders
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pending_orders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_orders;
    END IF;

    -- Settings
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'organization_settings') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_settings;
    END IF;

    -- Cost Prices
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'cost_prices') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cost_prices;
    END IF;

    -- Inventory History
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_history') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_history;
    END IF;

    -- Waste Reports
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'waste_reports') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.waste_reports;
    END IF;
END $$;

-- Set replica identity to FULL for realtime
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.inventory REPLICA IDENTITY FULL;
ALTER TABLE public.prices REPLICA IDENTITY FULL;
ALTER TABLE public.emission_types REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.pending_orders REPLICA IDENTITY FULL;
ALTER TABLE public.organization_settings REPLICA IDENTITY FULL;
ALTER TABLE public.cost_prices REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_history REPLICA IDENTITY FULL;
ALTER TABLE public.waste_reports REPLICA IDENTITY FULL;

-- ====================================================================
-- INITIAL DATA SETUP
-- ====================================================================

-- Insert default emission types for all organizations
INSERT INTO public.emission_types (organization_id, name, units, subtype)
SELECT 
    DISTINCT organization_id, 
    vals.name, 
    vals.units, 
    vals.subtype
FROM 
    public.profiles,
    (VALUES 
        ('Caja', 36, 'Botella'),
        ('Media Caja', 18, 'Botella'),
        ('Caja', 24, 'Botella Tercio'),
        ('Media Caja', 12, 'Botella Tercio'),
        ('Caja', 24, 'Lata'),
        ('Media Caja', 12, 'Lata'),
        ('Six Pack', 6, 'Lata')
    ) AS vals(name, units, subtype)
WHERE 
    organization_id IS NOT NULL
ON CONFLICT (organization_id, name, subtype) 
DO NOTHING;

-- ====================================================================
-- VERIFICATION QUERIES
-- ====================================================================

-- Count tables
SELECT 'Schema Setup Complete' as status,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies;

-- Show organizations with their license status
SELECT 
    o.id,
    o.name,
    o.trial_started_at,
    CASE 
        WHEN o.trial_started_at IS NULL THEN 'Sin Trial'
        WHEN NOW() < (o.trial_started_at + INTERVAL '7 days') THEN 'Trial Activo'
        ELSE 'Trial Expirado'
    END as trial_status,
    CASE 
        WHEN o.is_active = TRUE THEN 'Con Licencia'
        ELSE 'Sin Licencia'
    END as license_status
FROM public.organizations o
ORDER BY o.created_at DESC
LIMIT 10;

-- ====================================================================
-- END OF SCHEMA
-- ====================================================================
