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
