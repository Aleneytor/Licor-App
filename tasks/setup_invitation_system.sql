-- ==============================================================================
-- SETUP: INVITATION SYSTEM
-- Description: Creates the organization_invites table and sets up RLS.
-- ==============================================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.organization_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'EMPLOYEE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT organization_invites_unique UNIQUE(email, organization_id)
);

-- 2. Enable RLS
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Only owners/admins/managers can manage invites for their organization
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

-- Anyone can view their own invites by email (needed for registration completion check)
-- Note: During registration completion, the user is already authenticated via Magic Link (OTP)
DROP POLICY IF EXISTS "Users can view their own invites" ON public.organization_invites;
CREATE POLICY "Users can view their own invites" ON public.organization_invites
    FOR SELECT USING (
        LOWER(email) = (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid())
    );

-- 4. Fix potential Trigger issue on auth.users
-- If there's an 'after insert' trigger on auth.users that expects metadata, 
-- and it fails, it blocks user creation. 
-- Let's make sure the profile trigger is robust (handles missing metadata).

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

-- Re-create the trigger if it was pointing elsewhere or missing
-- Check your actual trigger name if possible, commonly 'on_auth_user_created'
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

SELECT 'Invitation system tables and policies configured.' AS status;
