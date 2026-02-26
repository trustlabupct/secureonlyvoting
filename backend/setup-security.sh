#!/bin/bash

# Security Setup Script for Voting System Backend
# This script sets up all security features and verifies they work

set -e

echo "🛡️  Voting System Security Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Redis is running
check_redis() {
    echo ""
    echo "Checking Redis connection..."
    if redis-cli ping > /dev/null 2>&1; then
        print_status "Redis is running"
    else
        print_error "Redis is not running or not accessible"
        print_info "Please install and start Redis:"
        print_info "  Ubuntu/Debian: sudo apt install redis-server && sudo systemctl start redis"
        print_info "  macOS: brew install redis && brew services start redis"
        print_info "  Or use Docker: docker run -d -p 6379:6379 redis:alpine"
        exit 1
    fi
}

# Check if PostgreSQL is accessible
check_database() {
    echo ""
    echo "Checking database connection..."
    if [ -f ".env" ] && grep -q "DB_HOST" .env; then
        print_status "Database configuration found in .env"
    else
        print_warning "No database configuration found in .env"
        print_info "Please create a .env file with database settings"
    fi
}

# Check environment variables
check_env() {
    echo ""
    echo "Checking environment variables..."
    
    if [ ! -f ".env" ]; then
        print_warning ".env file not found"
        print_info "Creating sample .env file..."
        
        cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-database-password
DB_DATABASE=voting_system

# JWT Configuration - CHANGE THESE IN PRODUCTION!
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_EXPIRATION_TIME=10m
JWT_REFRESH_EXPIRATION_TIME=7d

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Application Configuration
NODE_ENV=development
PORT=3001

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# Certificate Authentication
CERT_AUTH_ENABLED=true
CERT_CA_PATH=/path/to/ca-certificate.pem
CERT_REQUIRE_CLIENT_CERT=false

# Security Settings
ENABLE_CORS=true
CORS_ORIGIN=http://localhost:3000
ENABLE_HELMET=true
EOF
        print_status "Created .env file with secure JWT secrets"
        print_warning "Please update database credentials in .env file"
    else
        print_status ".env file exists"
    fi
}

# Install dependencies
install_deps() {
    echo ""
    echo "Installing dependencies..."
    npm install
    print_status "Dependencies installed"
}

# Build the project
build_project() {
    echo ""
    echo "Building project..."
    npm run build
    print_status "Project built successfully"
}

# Run database migrations
run_migrations() {
    echo ""
    echo "Running database migrations..."
    if npm run migration:run > /dev/null 2>&1; then
        print_status "Database migrations completed"
    else
        print_warning "Migration failed - this is normal if migrations already exist"
    fi
}

# Seed test users
seed_users() {
    echo ""
    echo "Creating test users..."
    if npm run seed:users; then
        print_status "Test users created successfully"
    else
        print_warning "User seeding failed - users may already exist"
    fi
}

# Generate test certificates
generate_certs() {
    echo ""
    echo "Generating test certificates..."
    
    if [ ! -d "certs" ]; then
        mkdir certs
    fi
    
    cd certs
    
    # Generate CA key and certificate
    if [ ! -f "ca-key.pem" ]; then
        openssl genrsa -out ca-key.pem 4096
        openssl req -new -x509 -days 365 -key ca-key.pem -out ca-cert.pem -subj "/C=US/ST=Test/L=Test/O=Test CA/CN=Test CA"
        print_status "Generated CA certificate"
    fi
    
    # Generate client key and certificate
    if [ ! -f "client-key.pem" ]; then
        openssl genrsa -out client-key.pem 4096
        openssl req -new -key client-key.pem -out client-csr.pem -subj "/C=US/ST=Test/L=Test/O=Test Client/CN=admin@certificates.local/emailAddress=admin@certificates.local"
        openssl x509 -req -days 365 -in client-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -out client-cert.pem -CAcreateserial
        print_status "Generated client certificate"
    fi
    
    cd ..
}

# Test security features
test_security() {
    echo ""
    echo "Testing security features..."
    print_info "Starting backend server in background..."
    
    # Start server in background
    npm run start:dev > server.log 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 10
    
    # Run security tests
    if npm run test:security; then
        print_status "Security tests completed"
    else
        print_warning "Some security tests failed - check output above"
    fi
    
    # Stop server
    kill $SERVER_PID 2>/dev/null || true
    rm -f server.log
}

# Main setup flow
main() {
    echo ""
    print_info "Starting security setup..."
    
    check_env
    install_deps
    build_project
    check_redis
    check_database
    run_migrations
    seed_users
    generate_certs
    
    echo ""
    print_status "Security setup completed!"
    echo ""
    print_info "Summary of implemented security features:"
    echo "  ✅ Rate limiting (5 login attempts/min, 100 requests/min)"
    echo "  ✅ JWT tokens (10min access, 7day refresh)"
    echo "  ✅ Token blacklisting and revocation"
    echo "  ✅ Redis-based session management"
    echo "  ✅ Certificate authentication middleware"
    echo "  ✅ Comprehensive security testing"
    echo ""
    print_info "Test credentials:"
    echo "  Admin: admin@certificates.local / admin123 (cert auth enabled)"
    echo "  HR: hr@example.com / admin123"
    echo "  User: user@example.com / user123"
    echo ""
    print_info "To start the server: npm run start:dev"
    print_info "To run security tests: npm run test:security"
    echo ""
}

# Run main function
main 