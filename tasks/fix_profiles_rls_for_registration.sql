-- ==============================================================================
-- FIX: PROFILES RLS FOR REGISTRATION
-- Description: Ensures that newly invited users can update their own profile
--              to complete their registration (set name, org, and role).
-- ==============================================================================

-- 1. Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies if they exist (to replace them)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;

-- 3. Create permissive policies for the registration flow

-- Policy: Users can view their own profile record
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own profile record
-- This allows them to set full_name, organization_id, and role during CompleteRegistration.jsx
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can insert their own profile record (as a fallback for upsert)
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Admin/Manager policies (needed for the rest of the app)
DROP POLICY IF EXISTS "Admins can view profiles in their org" ON public.profiles;
CREATE POLICY "Admins can view profiles in their org" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles AS viewer
            WHERE viewer.id = auth.uid()
            AND viewer.organization_id = public.profiles.organization_id
            AND viewer.role IN ('master', 'owner', 'admin', 'manager', 'developer', 'OWNER', 'ADMIN', 'MANAGER', 'DEVELOPER')
        )
    );

-- 5. Ensure the handle_new_user trigger is robust
-- Sometimes the trigger fails if metadata is missing, preventing user logins.
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

SELECT 'RLS policies for profiles have been updated for registration support.' AS status;
