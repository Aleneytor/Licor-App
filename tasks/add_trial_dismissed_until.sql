-- Add trial_dismissed_until column to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS trial_dismissed_until TIMESTAMPTZ;
