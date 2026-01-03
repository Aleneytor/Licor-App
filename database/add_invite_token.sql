-- Add token column to organization_invites if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_invites' 
        AND column_name = 'token'
    ) THEN
        ALTER TABLE public.organization_invites 
        ADD COLUMN token TEXT UNIQUE DEFAULT gen_random_uuid()::text;
        
        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_organization_invites_token 
        ON public.organization_invites(token);
    END IF;
END $$;

-- Update existing records without tokens
UPDATE public.organization_invites 
SET token = gen_random_uuid()::text 
WHERE token IS NULL;
