import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SecurityService } from '../security/security.service';
import { Logger } from '@nestjs/common';

async function seedRateLimitPolicies() {
  const logger = new Logger('RateLimitPolicySeeder');

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);
    const securityService = app.get(SecurityService);

    logger.log('🔧 Seeding Rate Limit Policies');
    logger.log('='.repeat(50));

    // Define the rate limit policies to create
    const policies = [
      // Auth endpoints - refined based on real-world usage patterns
      {
        endpoint: 'POST:/api/auth/login',
        maxAttempts: 20,
        windowMs: 60000, // 1 minute - increased to 20 for mobile/network retries + wrong password scenarios
        description: 'Login attempts - 20 per minute',
      },
      {
        endpoint: 'GET:/api/auth/profile',
        maxAttempts: 30,
        windowMs: 60000, // 1 minute - maintains good performance for dashboard refreshes
        description: 'Profile fetch - 30 per minute',
      },
      {
        endpoint: 'POST:/api/auth/mfa/setup',
        maxAttempts: 10,
        windowMs: 60000, // 1 minute
        description: 'MFA setup - 10 per minute',
      },
      {
        endpoint: 'POST:/api/auth/mfa/enable',
        maxAttempts: 10,
        windowMs: 60000, // 1 minute
        description: 'MFA enable - 10 per minute',
      },
      {
        endpoint: 'POST:/api/auth/mfa/verify-login',
        maxAttempts: 15,
        windowMs: 120000, // 2 minutes - increased to 15 for better clock drift accommodation
        description: 'MFA verification during login - 15 per 2 minutes',
      },
      {
        endpoint: 'POST:/api/auth/mfa/recovery-login',
        maxAttempts: 5,
        windowMs: 60000, // 1 minute - keeping strict as recovery codes are limited
        description: 'MFA recovery login - 5 per minute',
      },
      {
        endpoint: 'DELETE:/api/auth/mfa',
        maxAttempts: 10,
        windowMs: 60000, // 1 minute
        description: 'MFA disable - 10 per minute',
      },
      {
        endpoint: 'POST:/api/auth/mfa/recovery-codes',
        maxAttempts: 5,
        windowMs: 300000, // 5 minutes - keeping tight for recovery code regeneration
        description: 'MFA recovery codes regeneration - 5 per 5 minutes',
      },
      {
        endpoint: 'POST:/api/auth/mfa/verify',
        maxAttempts: 10,
        windowMs: 120000, // 2 minutes - maintains good UX during setup
        description: 'MFA verification after setup - 10 per 2 minutes',
      },
      {
        endpoint: 'POST:/api/auth/verify-password',
        maxAttempts: 10,
        windowMs: 600000, // 10 minutes - increased to 10 for multi-step flows
        description:
          'Password verification before sensitive actions - 10 per 10 minutes',
      },
      {
        endpoint: 'POST:/api/auth/change-password',
        maxAttempts: 5,
        windowMs: 3600000, // 1 hour - keeps strict as this is critical
        description: 'Password change attempts - 5 per hour',
      },
      {
        endpoint: 'POST:/api/auth/refresh',
        maxAttempts: 25,
        windowMs: 60000, // 1 minute - increased to 25 so automated clients rarely hit the cap
        description: 'Token refresh - 25 per minute',
      },
      {
        endpoint: 'POST:/api/auth/logout',
        maxAttempts: 15,
        windowMs: 60000, // 1 minute - increased to 15 for concurrent sessions
        description: 'Logout - 15 per minute',
      },
      {
        endpoint: 'POST:/api/auth/mfa/verify-recovery',
        maxAttempts: 5,
        windowMs: 60000, // 1 minute - keeping strict for recovery code verification
        description: 'MFA recovery code verification - 5 per minute',
      },

      // Voting endpoints - optimized for different voting scenarios
      {
        endpoint: 'POST:/api/votes',
        maxAttempts: 10,
        windowMs: 60000, // 1 minute - increased to 10 to support rapid polling scenarios
        description: 'Vote submission - 10 per minute',
      },
      {
        endpoint: 'GET:/api/votes/check',
        maxAttempts: 20,
        windowMs: 60000, // 1 minute - maintains good performance for active polling
        description: 'Vote check - 20 per minute',
      },
      {
        endpoint: 'GET:/api/votes/history',
        maxAttempts: 15,
        windowMs: 60000, // 1 minute - good for pagination scenarios
        description: 'Voting history - 15 per minute',
      },

      // Poll endpoints - enhanced for browsing and real-time updates
      {
        endpoint: 'GET:/api/polls',
        maxAttempts: 60,
        windowMs: 60000, // 1 minute - increased to 60 for instantaneous browsing feel
        description: 'Poll listing - 60 per minute',
      },
      {
        endpoint: 'GET:/api/polls/:id',
        maxAttempts: 25,
        windowMs: 60000, // 1 minute - maintains good detail viewing performance
        description: 'Poll details - 25 per minute',
      },
      {
        endpoint: 'GET:/api/polls/:id/results',
        maxAttempts: 30,
        windowMs: 60000, // 1 minute - increased to 30 for real-time dashboards that poll frequently
        description: 'Poll results - 30 per minute',
      },

      // Admin endpoints - enhanced for bulk management while maintaining security
      {
        endpoint: 'POST:/api/admin/polls',
        maxAttempts: 10,
        windowMs: 60000, // 1 minute - increased to 10 for bulk creation use cases
        description: 'Admin poll creation - 10 per minute',
      },
      {
        endpoint: 'PATCH:/api/admin/polls/:id',
        maxAttempts: 20,
        windowMs: 60000, // 1 minute - increased to 20 for iterative editing workflows
        description: 'Admin poll updates - 20 per minute',
      },
      {
        endpoint: 'DELETE:/api/admin/polls/:id',
        maxAttempts: 10,
        windowMs: 60000, // 1 minute - increased to 10 for batch cleanup scenarios
        description: 'Admin poll deletion - 10 per minute',
      },

      // Tally service endpoints - Critical for homomorphic encryption security
      {
        endpoint: 'POST:/api/tally/encrypt',
        maxAttempts: 50,
        windowMs: 60000, // 1 minute - allows for batch voting scenarios but prevents resource exhaustion
        description: 'Homomorphic encryption - 50 per minute',
      },
      {
        endpoint: 'POST:/api/tally/aggregate/:id',
        maxAttempts: 5,
        windowMs: 60000, // 1 minute - admin function, keep strict
        description: 'Tally aggregation - 5 per minute (admin only)',
      },
      {
        endpoint: 'POST:/api/tally/decrypt/:id',
        maxAttempts: 3,
        windowMs: 300000, // 5 minutes - very sensitive operation
        description: 'Tally decryption - 3 per 5 minutes (admin only)',
      },
      {
        endpoint: 'DELETE:/api/tally/cleanup/:id',
        maxAttempts: 5,
        windowMs: 60000, // 1 minute - cleanup operations
        description: 'Tally cleanup - 5 per minute (admin only)',
      },

      // Blind token endpoints - Critical for anonymous voting security
      {
        endpoint: 'GET:/api/blind-tokens/public-key',
        maxAttempts: 30,
        windowMs: 60000, // 1 minute - public endpoint but limit to prevent abuse
        description: 'Blind token public key - 30 per minute',
      },
      {
        endpoint: 'POST:/api/blind-tokens/generate',
        maxAttempts: 20,
        windowMs: 60000, // 1 minute - allow reasonable anonymous voting scenarios
        description: 'Blind token generation - 20 per minute',
      },
      {
        endpoint: 'POST:/api/blind-tokens/sign',
        maxAttempts: 25,
        windowMs: 60000, // 1 minute - signature operations
        description: 'Blind token signing - 25 per minute',
      },

      // Additional security endpoints
      {
        endpoint: 'GET:/api/admin/security/metrics',
        maxAttempts: 15,
        windowMs: 60000, // 1 minute - admin dashboard queries
        description: 'Security metrics - 15 per minute (admin only)',
      },
      {
        endpoint: 'POST:/api/admin/security/cleanup',
        maxAttempts: 5,
        windowMs: 300000, // 5 minutes - manual cleanup operations
        description: 'Security cleanup - 5 per 5 minutes (admin only)',
      },
      {
        endpoint: 'GET:/api/polls/:id/vote-count',
        maxAttempts: 30,
        windowMs: 60000, // 1 minute - real-time vote counting
        description: 'Vote count queries - 30 per minute',
      },
    ];

    // Create all policies
    let created = 0;
    const updated = 0;

    for (const policy of policies) {
      try {
        const existingPolicy = await securityService.upsertRateLimitPolicy(
          policy.endpoint,
          policy.maxAttempts,
          policy.windowMs,
          policy.description,
          true,
        );

        if (existingPolicy) {
          logger.log(
            `✅ Policy for ${policy.endpoint}: ${policy.maxAttempts} requests/${policy.windowMs}ms`,
          );
          created++;
        }
      } catch (error) {
        logger.error(
          `❌ Failed to create policy for ${policy.endpoint}:`,
          error.message,
        );
      }
    }

    // Refresh the policy cache
    await securityService.refreshPolicyCache();
    logger.log('✅ Policy cache refreshed');

    // Summary
    logger.log('\n' + '='.repeat(50));
    logger.log(`🎉 Rate Limit Policy Seeding Complete:`);
    logger.log(`   - Policies processed: ${policies.length}`);
    logger.log(`   - Successfully created/updated: ${created}`);
    logger.log(`   - Cache refreshed: ✅`);
    logger.log('='.repeat(50));

    await app.close();
  } catch (error) {
    logger.error('❌ Rate limit policy seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeder
if (require.main === module) {
  seedRateLimitPolicies()
    .then(() => {
      console.log('\n🎉 Rate limit policies seeded successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedRateLimitPolicies };
