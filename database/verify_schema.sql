-- ====================================================================
-- SCHEMA VERIFICATION SCRIPT
-- ====================================================================
-- Run this after master_schema.sql to verify everything is correct
-- ====================================================================

-- 1. Count Tables
SELECT 
    'Table Count' as check_name,
    COUNT(*) as result,
    CASE WHEN COUNT(*) >= 16 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM pg_tables 
WHERE schemaname = 'public';

-- 2. List All Tables
SELECT 
    'All Tables' as check_name,
    tablename as table_name
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Count RLS Policies
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 4. Verify Indexes
SELECT 
    tablename,
    indexname
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. Check Foreign Keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 6. Verify Triggers
SELECT 
    event_object_table as table_name,
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 7. Check Functions
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 8. Verify Trial System
SELECT 
    'Trial System Check' as check_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'trial_started_at') 
        THEN '✅ trial_started_at exists'
        ELSE '❌ Missing trial_started_at'
    END as result;

SELECT 
    'Trial Functions' as check_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_trial_active')
            AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_trial_info')
            AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_trial_status')
        THEN '✅ All trial functions exist'
        ELSE '❌ Missing trial functions'
    END as result;

-- 9. Check Realtime Setup
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
ORDER BY tablename;

-- 10. Sample Data Verification
SELECT 
    'Organizations' as table_name,
    COUNT(*) as row_count
FROM public.organizations
UNION ALL
SELECT 'Profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'Products', COUNT(*) FROM public.products
UNION ALL
SELECT 'Orders', COUNT(*) FROM public.orders
UNION ALL
SELECT 'License Keys', COUNT(*) FROM public.license_keys;

-- 11. Check for Duplicate Policies (should be 0)
SELECT 
    '❌ DUPLICATE POLICIES FOUND' as warning,
    tablename,
    policyname,
    COUNT(*) as duplicate_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, policyname
HAVING COUNT(*) > 1;

-- 12. Organizations with Trial Status
SELECT 
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
ORDER BY o.created_at DESC;

-- 13. Final Summary
SELECT 
    '=== VERIFICATION SUMMARY ===' as summary,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as tables,
    (SELECT COUNT(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') as tables_with_rls,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as indexes,
    (SELECT COUNT(*) FROM pg_trigger WHERE tgrelid::regclass::text LIKE 'public.%') as triggers,
    (SELECT COUNT(*) FROM pg_proc WHERE pronamespace::regnamespace::text = 'public') as functions;

SELECT '✅ Schema verification complete!' as status;
