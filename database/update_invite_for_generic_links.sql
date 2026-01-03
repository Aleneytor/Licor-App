-- Make email nullable for generic invitation links
ALTER TABLE public.organization_invites 
ALTER COLUMN email DROP NOT NULL;

-- Update unique constraint to allow multiple invites with same role
DROP INDEX IF EXISTS organization_invites_email_organization_id_key;
ALTER TABLE public.organization_invites 
DROP CONSTRAINT IF EXISTS organization_invites_unique;

-- Add expiration date for links (optional, 7 days by default)
ALTER TABLE public.organization_invites 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_organization_invites_token_status 
ON public.organization_invites(token, status) 
WHERE status = 'pending';
