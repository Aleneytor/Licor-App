-- 1. Add trial tracking column to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;

-- 2. Update existing active free organizations as having used trial
UPDATE public.organizations 
SET has_used_trial = TRUE 
WHERE plan_type = 'free' AND is_active = TRUE;

-- 3. Update RLS for license_keys to allow trial activation insertion
-- This allows a user to "create" their own trial key record for tracking
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

-- 4. Ensure RLS for organizations table allows updates to trial status
-- Usually owners/masters should be able to update their own organization
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
