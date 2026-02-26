# PostgreSQL pg_stat_statements Setup Guide

## Overview

`pg_stat_statements` is a PostgreSQL extension that tracks execution statistics for all SQL statements executed by a server. This is essential for performance monitoring in the TRUSTLab Voting System's enhanced rate limiting implementation.

## Prerequisites

- PostgreSQL 12+ (recommended 14+)
- Administrative access to PostgreSQL configuration
- Ability to restart PostgreSQL service

## Setup Instructions

### 1. Enable in PostgreSQL Configuration

Edit `postgresql.conf` (usually located in `/etc/postgresql/{version}/main/postgresql.conf`):

```conf
# Add or modify the following lines:
shared_preload_libraries = 'pg_stat_statements'

# Configure pg_stat_statements settings
pg_stat_statements.max = 10000
pg_stat_statements.track = all
pg_stat_statements.track_utility = on
pg_stat_statements.save = on
```

### 2. Restart PostgreSQL

```bash
# Ubuntu/Debian
sudo systemctl restart postgresql

# CentOS/RHEL
sudo systemctl restart postgresql

# Or using service command
sudo service postgresql restart
```

### 3. Install Extension in Database

Run the setup script:

```bash
# From the backend directory
chmod +x scripts/enable-pg-stat-statements.sh
./scripts/enable-pg-stat-statements.sh
```

Or manually:

```sql
-- Connect to your database
\c voting_system

-- Create the extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify installation
SELECT * FROM pg_stat_statements LIMIT 1;
```

### 4. Verify Setup

After running some queries, check that statistics are being collected:

```sql
SELECT 
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements 
WHERE query LIKE '%rate_limit%'
ORDER BY calls DESC
LIMIT 10;
```

## Configuration Options

### Basic Configuration
```conf
# Minimum recommended settings
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000
pg_stat_statements.track = all
```

### Production Configuration
```conf
# Optimized for production monitoring
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 20000
pg_stat_statements.track = all
pg_stat_statements.track_utility = on
pg_stat_statements.save = on
pg_stat_statements.track_planning = on
```

### High-Load Configuration
```conf
# For high-traffic applications
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 50000
pg_stat_statements.track = all
pg_stat_statements.track_utility = on
pg_stat_statements.save = on
pg_stat_statements.track_planning = on
pg_stat_statements.normalize = on
```

## Monitoring Queries

### Rate Limiting Performance
```sql
SELECT 
    query,
    calls,
    mean_exec_time,
    max_exec_time,
    total_exec_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%rate_limit%' 
   OR query LIKE '%INSERT INTO "rate_limits"%'
   OR query LIKE '%rate_limit_policies%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Top Slow Queries
```sql
SELECT 
    query,
    calls,
    mean_exec_time,
    max_exec_time,
    (total_exec_time/calls) as avg_time
FROM pg_stat_statements 
WHERE calls > 10
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Most Frequent Queries
```sql
SELECT 
    query,
    calls,
    mean_exec_time,
    total_exec_time
FROM pg_stat_statements 
ORDER BY calls DESC
LIMIT 20;
```

## Integration with Application

The TRUSTLab Voting System's SecurityService includes automatic performance monitoring:

```typescript
// Available endpoint for admins
GET /admin/security/performance

// Returns performance statistics including:
{
  "success": true,
  "performanceStats": [
    {
      "query": "INSERT INTO rate_limits...",
      "calls": 1250,
      "mean_exec_time": 1.45,
      "max_exec_time": 12.3,
      "total_exec_time": 1812.5
    }
  ],
  "timestamp": "2025-06-12T10:00:00.000Z"
}
```

## Troubleshooting

### Extension Not Found
```
ERROR: could not access file "pg_stat_statements": No such file or directory
```
**Solution**: Install postgresql-contrib package:
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-contrib

# CentOS/RHEL  
sudo yum install postgresql-contrib
```

### Permission Denied
```
ERROR: permission denied to create extension "pg_stat_statements"
```
**Solution**: Connect as superuser:
```bash
sudo -u postgres psql voting_system
```

### Statistics Not Collecting
1. Check if extension is loaded:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';
   ```

2. Verify shared_preload_libraries:
   ```sql
   SHOW shared_preload_libraries;
   ```

3. Check if statistics are enabled:
   ```sql
   SELECT * FROM pg_stat_statements LIMIT 1;
   ```

### Reset Statistics
To clear all collected statistics:
```sql
SELECT pg_stat_statements_reset();
```

## Maintenance

### Regular Monitoring
- Check query performance weekly
- Monitor for query regression
- Review top resource-consuming queries

### Automated Alerts
Set up monitoring for:
- Queries with mean_exec_time > 100ms
- Queries with high call frequency
- Failed query patterns

### Cleanup
Statistics are automatically managed, but you can reset if needed:
```sql
-- Reset all statistics
SELECT pg_stat_statements_reset();

-- Reset statistics for specific query
SELECT pg_stat_statements_reset(userid, dbid, queryid);
```

## Security Considerations

1. **Access Control**: Only admin users should access performance statistics
2. **Query Exposure**: pg_stat_statements may expose query patterns
3. **Performance Impact**: Minimal (<1%) overhead in most cases
4. **Storage**: Statistics consume memory (shared_preload_libraries)

## Production Deployment Checklist

- [ ] PostgreSQL configuration updated
- [ ] PostgreSQL service restarted
- [ ] Extension installed in database
- [ ] Performance monitoring verified
- [ ] Application endpoints tested
- [ ] Monitoring alerts configured
- [ ] Documentation shared with team

## Support

For issues with pg_stat_statements setup:
1. Check PostgreSQL logs for errors
2. Verify extension installation
3. Test with simple queries first
4. Consult PostgreSQL documentation
5. Contact database administrator if needed 