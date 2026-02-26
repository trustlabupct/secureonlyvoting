#!/usr/bin/env node

/**
 * CI Health Check Script
 * Tests the TRUSTLab Voting System's security endpoints for CI/CD pipelines
 * 
 * Usage: node scripts/ci-health-check.js [--host=localhost] [--port=3001] [--timeout=30000]
 */

const http = require('http');
const https = require('https');

// Configuration from environment or defaults
const config = {
  host: process.env.CI_HOST || 'localhost',
  port: parseInt(process.env.CI_PORT || '3001'),
  timeout: parseInt(process.env.CI_TIMEOUT || '30000'),
  protocol: process.env.CI_PROTOCOL || 'http',
  maxRetries: parseInt(process.env.CI_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.CI_RETRY_DELAY || '2000')
};

// Parse command line arguments
process.argv.forEach(arg => {
  if (arg.startsWith('--host=')) config.host = arg.split('=')[1];
  if (arg.startsWith('--port=')) config.port = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--timeout=')) config.timeout = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--protocol=')) config.protocol = arg.split('=')[1];
});

const baseUrl = `${config.protocol}://${config.host}:${config.port}`;

console.log('🏥 TRUSTLab Voting System - CI Health Check');
console.log('==========================================');
console.log(`Target: ${baseUrl}`);
console.log(`Timeout: ${config.timeout}ms`);
console.log(`Max Retries: ${config.maxRetries}`);
console.log('');

// Health check tests
const healthChecks = [
  {
    name: 'Public Health Check',
    path: '/api/admin/security/health/public',
    method: 'GET',
    expectedStatus: [200],
    critical: true,
    description: 'Basic system health without authentication'
  },
  {
    name: 'Database Connectivity',
    path: '/api/admin/security/health/public',
    method: 'GET',
    expectedStatus: [200, 503], // 503 is acceptable for degraded but not critical
    critical: true,
    description: 'Database connection test',
    validateResponse: (data) => {
      return data.database !== false; // Database should be connected or at least not false
    }
  }
];

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      timeout: config.timeout,
      headers: {
        'User-Agent': 'TRUSTLab-CI-HealthCheck/1.0',
        'Accept': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData,
            raw: data
          });
        } catch (parseError) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: {},
            raw: data,
            parseError: true
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${config.timeout}ms`));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Retry helper
async function withRetry(fn, retries = config.maxRetries) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries) {
        throw error;
      }
      console.log(`  ⏳ Retry ${i + 1}/${retries} after error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, config.retryDelay));
    }
  }
}

// Run a single health check
async function runHealthCheck(check) {
  console.log(`🔍 ${check.name}`);
  console.log(`   ${check.description}`);
  console.log(`   Testing: ${check.method} ${check.path}`);
  
  try {
    const response = await withRetry(() => 
      makeRequest(`${baseUrl}${check.path}`, {
        method: check.method,
        headers: check.headers,
        body: check.body
      })
    );

    const statusOk = check.expectedStatus.includes(response.status);
    const validationOk = check.validateResponse ? check.validateResponse(response.data) : true;
    
    if (statusOk && validationOk) {
      console.log(`   ✅ PASS - Status: ${response.status}, Response time: ${response.headers['x-response-time'] || 'N/A'}`);
      
      if (response.data.status) {
        console.log(`   📊 System Status: ${response.data.status}`);
      }
      
      if (response.data.responseTime) {
        console.log(`   ⚡ Database Response: ${response.data.responseTime}`);
      }
      
      return { success: true, check, response };
    } else {
      const reason = !statusOk ? 
        `Unexpected status ${response.status} (expected ${check.expectedStatus.join(' or ')})` :
        'Response validation failed';
        
      console.log(`   ❌ FAIL - ${reason}`);
      console.log(`   📝 Response: ${JSON.stringify(response.data, null, 2)}`);
      
      return { success: false, check, response, reason };
    }
  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    return { success: false, check, error: error.message };
  }
}

// Main health check runner
async function runAllHealthChecks() {
  console.log('🚀 Starting health checks...\n');
  
  const results = [];
  let criticalFailures = 0;
  let totalFailures = 0;
  
  for (const check of healthChecks) {
    const result = await runHealthCheck(check);
    results.push(result);
    
    if (!result.success) {
      totalFailures++;
      if (check.critical) {
        criticalFailures++;
      }
    }
    
    console.log(''); // Empty line between checks
  }
  
  // Summary
  console.log('📋 Health Check Summary');
  console.log('=======================');
  console.log(`Total checks: ${healthChecks.length}`);
  console.log(`Passed: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${totalFailures}`);
  console.log(`Critical failures: ${criticalFailures}`);
  console.log('');
  
  // Detailed results for failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('❌ Failed Checks:');
    failures.forEach(failure => {
      console.log(`   • ${failure.check.name}: ${failure.reason || failure.error}`);
    });
    console.log('');
  }
  
  // Exit code determination
  if (criticalFailures > 0) {
    console.log('💥 CRITICAL FAILURES DETECTED - CI should fail');
    process.exit(1);
  } else if (totalFailures > 0) {
    console.log('⚠️  NON-CRITICAL FAILURES - CI can continue with warnings');
    process.exit(0); // Or process.exit(1) if you want to fail on any error
  } else {
    console.log('✅ ALL HEALTH CHECKS PASSED - System is ready');
    process.exit(0);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Health check interrupted');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Health check terminated');
  process.exit(143);
});

// Run the health checks
runAllHealthChecks().catch(error => {
  console.error('💥 Unexpected error during health check:', error);
  process.exit(1);
}); 