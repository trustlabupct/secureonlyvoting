#!/bin/bash

# PostgreSQL pg_stat_statements Setup Script
# Enables the pg_stat_statements extension for performance monitoring

set -e  # Exit on any error

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-voting_system}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-NR7m1PLW7jLchZt9ghxE/q97NylIzL5nWJUhN/qsFas=}"

echo "🔧 Setting up pg_stat_statements extension..."
echo "Database: $DB_NAME on $DB_HOST:$DB_PORT"

# Function to run PostgreSQL commands
run_psql() {
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# Check if PostgreSQL is accessible
echo "📡 Testing database connection..."
if ! run_psql "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Error: Cannot connect to PostgreSQL database"
    echo "Please check your database credentials and ensure PostgreSQL is running"
    exit 1
fi
echo "✅ Database connection successful"

# Check if pg_stat_statements is already installed
echo "🔍 Checking if pg_stat_statements extension exists..."
EXTENSION_EXISTS=$(run_psql "SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_stat_statements';" | grep -oE '[0-9]+' || echo "0")

if [ "$EXTENSION_EXISTS" -gt 0 ]; then
    echo "✅ pg_stat_statements extension is already installed"
else
    echo "📦 Installing pg_stat_statements extension..."
    
    # Try to create the extension
    if run_psql "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" > /dev/null 2>&1; then
        echo "✅ pg_stat_statements extension installed successfully"
    else
        echo "❌ Error: Failed to install pg_stat_statements extension"
        echo ""
        echo "This likely means one of the following:"
        echo "1. shared_preload_libraries doesn't include 'pg_stat_statements'"
        echo "2. PostgreSQL contrib package is not installed"
        echo "3. PostgreSQL needs to be restarted after configuration changes"
        echo ""
        echo "Please refer to scripts/setup-pg-stat-statements.md for detailed setup instructions"
        exit 1
    fi
fi

# Verify the extension is working
echo "🧪 Testing pg_stat_statements functionality..."
TEST_RESULT=$(run_psql "SELECT COUNT(*) FROM pg_stat_statements;" 2>/dev/null || echo "ERROR")

if [ "$TEST_RESULT" = "ERROR" ]; then
    echo "⚠️  Warning: pg_stat_statements extension is installed but not functioning"
    echo "This usually means PostgreSQL needs to be restarted after adding"
    echo "'pg_stat_statements' to shared_preload_libraries in postgresql.conf"
    echo ""
    echo "Steps to fix:"
    echo "1. Edit postgresql.conf and add: shared_preload_libraries = 'pg_stat_statements'"
    echo "2. Restart PostgreSQL: sudo systemctl restart postgresql"
    echo "3. Run this script again"
    exit 1
else
    echo "✅ pg_stat_statements is working correctly"
    echo "📊 Currently tracking $TEST_RESULT query statistics"
fi

# Show some sample data if available
echo ""
echo "📈 Sample performance data:"
SAMPLE_DATA=$(run_psql "SELECT query, calls, mean_exec_time FROM pg_stat_statements WHERE calls > 0 ORDER BY calls DESC LIMIT 3;" 2>/dev/null || echo "No data yet")

if [ "$SAMPLE_DATA" != "No data yet" ]; then
    echo "$SAMPLE_DATA"
else
    echo "No query statistics available yet (extension just installed)"
fi

# Final instructions
echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start your application to generate query statistics"
echo "2. Access performance data via: GET /admin/security/performance"
echo "3. Monitor query performance using the provided SQL queries in setup-pg-stat-statements.md"
echo ""
echo "For troubleshooting, see: backend/scripts/setup-pg-stat-statements.md" 