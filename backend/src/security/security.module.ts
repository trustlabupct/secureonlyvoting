import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SecurityService } from './security.service';
import { SecurityCleanupService } from './security-cleanup.service';
import { SecurityController } from './security.controller';
import { RateLimit } from './entities/rate-limit.entity';
import { RateLimitPolicy } from './entities/rate-limit-policy.entity';
import { RevokedToken } from './entities/revoked-token.entity';
import { UserSession } from './entities/user-session.entity';
import { AppMetrics } from './entities/app-metrics.entity';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { AuthModule } from '../auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RateLimit,
      RateLimitPolicy,
      RevokedToken,
      UserSession,
      AppMetrics,
    ]),
    ScheduleModule.forRoot(), // Enable scheduling
    forwardRef(() => AuthModule),
  ],
  controllers: [SecurityController],
  providers: [
    SecurityService,
    SecurityCleanupService,
    RateLimitGuard,
    RolesGuard,
  ],
  exports: [SecurityService, SecurityCleanupService, RateLimitGuard],
})
export class SecurityModule {}
