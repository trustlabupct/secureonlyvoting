-- PostgreSQL pg_stat_statements Extension Setup
-- This script enables the pg_stat_statements extension for performance monitoring
-- Run this as a PostgreSQL superuser

-- Enable the extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify the extension is installed
\echo 'Checking pg_stat_statements installation...'
SELECT 
    extname as "Extension Name",
    extversion as "Version",
    nspname as "Schema"
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname = 'pg_stat_statements';

-- Show current configuration
\echo 'Current pg_stat_statements configuration:'
SELECT 
    name,
    setting,
    unit,
    short_desc
FROM pg_settings 
WHERE name LIKE 'pg_stat_statements%'
ORDER BY name;

-- Test basic functionality
\echo 'Testing pg_stat_statements functionality...'
SELECT 
    'Extension is working correctly' as status,
    count(*) as "Queries tracked"
FROM pg_stat_statements;

-- Show sample data if available
\echo 'Sample performance data (top 5 queries by execution time):'
SELECT 
    LEFT(query, 60) as "Query Preview",
    calls as "Calls",
    ROUND(mean_exec_time::numeric, 2) as "Avg Time (ms)",
    ROUND(max_exec_time::numeric, 2) as "Max Time (ms)"
FROM pg_stat_statements 
WHERE calls > 0
ORDER BY mean_exec_time DESC
LIMIT 5;

\echo 'pg_stat_statements setup complete!'
\echo 'Access performance data via: GET /admin/security/performance' 