-- ==============================================================================
-- MIGRATION: ALLOW ALPHANUMERIC TICKET NUMBERS
-- Description: Changes ticket_number from integer to text to avoid exhaustion
-- ==============================================================================

do $$ 
begin
    -- 1. Alter 'orders' table
    if exists (select 1 from information_schema.columns where table_name='orders' and column_name='ticket_number' and data_type='integer') then
        alter table public.orders alter column ticket_number type text using ticket_number::text;
    end if;

    -- 2. Alter 'pending_orders' table
    if exists (select 1 from information_schema.columns where table_name='pending_orders' and column_name='ticket_number' and data_type='integer') then
        alter table public.pending_orders alter column ticket_number type text using ticket_number::text;
    end if;
end $$;

-- Confirmación
select 'Migration to alphanumeric tickets completed.' as status;
