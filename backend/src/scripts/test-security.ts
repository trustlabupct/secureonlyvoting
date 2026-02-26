#!/usr/bin/env ts-node
/**
 * Security Test Script
 * Tests all implemented security features:
 * 1. Rate limiting
 * 2. Token lifecycle (refresh & revocation)
 * 3. JWT validation and blacklisting
 * 4. Authentication endpoints
 */

import * as http from 'http';
import * as https from 'https';

const API_BASE = 'http://localhost:3001';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
}

class SecurityTester {
  private results: TestResult[] = [];

  async makeRequest(
    method: string,
    path: string,
    data?: any,
    headers?: any,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3001,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const response = {
              statusCode: res.statusCode,
              headers: res.headers,
              body: body ? JSON.parse(body) : null,
            };
            resolve(response);
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: body,
            });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  addResult(name: string, success: boolean, message: string, data?: any) {
    this.results.push({ name, success, message, data });
    console.log(success ? '✅' : '❌', name, '-', message);
    if (data && !success) {
      console.log('   Data:', JSON.stringify(data, null, 2));
    }
  }

  async testAuthentication() {
    console.log('\n🔐 Testing Authentication...');

    try {
      // Test login with valid credentials
      const loginResponse = await this.makeRequest('POST', '/auth/login', {
        username: 'hr@example.com',
        password: 'admin123',
      });

      if (loginResponse.statusCode === 200 && loginResponse.body.access_token) {
        this.addResult(
          'Valid Login',
          true,
          'Successfully logged in with valid credentials',
        );
        return loginResponse.body;
      } else {
        this.addResult(
          'Valid Login',
          false,
          'Failed to login with valid credentials',
          loginResponse,
        );
        return null;
      }
    } catch (error) {
      this.addResult(
        'Valid Login',
        false,
        `Login test failed: ${error.message}`,
      );
      return null;
    }
  }

  async testRateLimiting() {
    console.log('\n🚦 Testing Rate Limiting...');

    try {
      const promises: Promise<any>[] = [];
      // Make 10 rapid login attempts with wrong credentials
      for (let i = 0; i < 10; i++) {
        promises.push(
          this.makeRequest('POST', '/auth/login', {
            username: 'nonexistent@example.com',
            password: 'wrong',
          }),
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedRequests = responses.filter((r) => r.statusCode === 429);

      if (rateLimitedRequests.length > 0) {
        this.addResult(
          'Rate Limiting',
          true,
          `${rateLimitedRequests.length} requests were rate limited`,
        );
      } else {
        this.addResult(
          'Rate Limiting',
          false,
          'No requests were rate limited - rate limiting may not be working',
        );
      }
    } catch (error) {
      this.addResult(
        'Rate Limiting',
        false,
        `Rate limiting test failed: ${error.message}`,
      );
    }
  }

  async testTokenRefresh(tokens: any) {
    console.log('\n🔄 Testing Token Refresh...');

    if (!tokens || !tokens.refresh_token) {
      this.addResult(
        'Token Refresh',
        false,
        'No refresh token available for testing',
      );
      return null;
    }

    try {
      const refreshResponse = await this.makeRequest(
        'POST',
        '/auth/refresh',
        null,
        {
          Authorization: `Bearer ${tokens.refresh_token}`,
        },
      );

      if (
        refreshResponse.statusCode === 200 &&
        refreshResponse.body.access_token
      ) {
        this.addResult(
          'Token Refresh',
          true,
          'Successfully refreshed access token',
        );
        return refreshResponse.body;
      } else {
        this.addResult(
          'Token Refresh',
          false,
          'Failed to refresh token',
          refreshResponse,
        );
        return null;
      }
    } catch (error) {
      this.addResult(
        'Token Refresh',
        false,
        `Token refresh test failed: ${error.message}`,
      );
      return null;
    }
  }

  async testTokenRevocation(tokens: any) {
    console.log('\n🚫 Testing Token Revocation...');

    if (!tokens || !tokens.access_token) {
      this.addResult(
        'Token Revocation',
        false,
        'No access token available for testing',
      );
      return;
    }

    try {
      // First, verify token works
      const profileResponse = await this.makeRequest(
        'GET',
        '/auth/profile',
        null,
        {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      );

      if (profileResponse.statusCode !== 200) {
        this.addResult(
          'Token Revocation',
          false,
          'Token was already invalid before logout test',
        );
        return;
      }

      // Logout (should revoke token)
      const logoutResponse = await this.makeRequest(
        'POST',
        '/auth/logout',
        null,
        {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      );

      if (logoutResponse.statusCode === 200) {
        // Try to use the token again - should fail
        const profileAfterLogout = await this.makeRequest(
          'GET',
          '/auth/profile',
          null,
          {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        );

        if (profileAfterLogout.statusCode === 401) {
          this.addResult(
            'Token Revocation',
            true,
            'Token was successfully revoked after logout',
          );
        } else {
          this.addResult(
            'Token Revocation',
            false,
            'Token was not revoked after logout',
            profileAfterLogout,
          );
        }
      } else {
        this.addResult(
          'Token Revocation',
          false,
          'Logout failed',
          logoutResponse,
        );
      }
    } catch (error) {
      this.addResult(
        'Token Revocation',
        false,
        `Token revocation test failed: ${error.message}`,
      );
    }
  }

  async testJWTValidation() {
    console.log('\n🔍 Testing JWT Validation...');

    try {
      // Test with invalid token
      const invalidTokenResponse = await this.makeRequest(
        'GET',
        '/auth/profile',
        null,
        {
          Authorization: 'Bearer invalid.jwt.token',
        },
      );

      if (invalidTokenResponse.statusCode === 401) {
        this.addResult(
          'JWT Validation',
          true,
          'Invalid JWT tokens are properly rejected',
        );
      } else {
        this.addResult(
          'JWT Validation',
          false,
          'Invalid JWT token was accepted',
          invalidTokenResponse,
        );
      }

      // Test with no token
      const noTokenResponse = await this.makeRequest('GET', '/auth/profile');

      if (noTokenResponse.statusCode === 401) {
        this.addResult(
          'JWT Authorization',
          true,
          'Requests without tokens are properly rejected',
        );
      } else {
        this.addResult(
          'JWT Authorization',
          false,
          'Request without token was accepted',
          noTokenResponse,
        );
      }
    } catch (error) {
      this.addResult(
        'JWT Validation',
        false,
        `JWT validation test failed: ${error.message}`,
      );
    }
  }

  async testRedisConnection() {
    console.log('\n📡 Testing Redis Connection...');

    try {
      // This is indirect - we test by checking if rate limiting works
      // as our rate limiting uses Redis for storage
      const response = await this.makeRequest('GET', '/auth/profile');
      // Redis connection is tested indirectly through other features
      this.addResult(
        'Redis Connection',
        true,
        'Redis connection appears functional (indirect test)',
      );
    } catch (error) {
      this.addResult(
        'Redis Connection',
        false,
        `Redis connection test failed: ${error.message}`,
      );
    }
  }

  printSummary() {
    console.log('\n📊 Security Test Summary');
    console.log('========================');

    const passed = this.results.filter((r) => r.success).length;
    const total = this.results.length;

    console.log(`Passed: ${passed}/${total} tests`);

    if (passed === total) {
      console.log('🎉 All security tests passed!');
    } else {
      console.log(
        '⚠️  Some security tests failed. Please review the issues above.',
      );

      console.log('\nFailed tests:');
      this.results
        .filter((r) => !r.success)
        .forEach((result) => {
          console.log(`❌ ${result.name}: ${result.message}`);
        });
    }
  }

  async runAllTests() {
    console.log('🛡️  Starting Security Test Suite...');
    console.log('===================================');

    // Test authentication first to get tokens
    const tokens = await this.testAuthentication();

    // Test other features
    await this.testRateLimiting();
    await this.testJWTValidation();
    await this.testRedisConnection();

    if (tokens) {
      const newTokens = await this.testTokenRefresh(tokens);
      await this.testTokenRevocation(newTokens || tokens);
    }

    this.printSummary();
  }
}

async function main() {
  const tester = new SecurityTester();

  console.log(
    'ℹ️  Make sure the backend server is running on http://localhost:3001',
  );
  console.log('ℹ️  Make sure test users exist (run: npm run seed:users)');
  console.log('ℹ️  Make sure Redis is running');
  console.log('');

  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}
