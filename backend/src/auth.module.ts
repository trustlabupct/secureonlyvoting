import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from './users.module';
import { PollsModule } from './polls/polls.module';
import { SecurityModule } from './security/security.module';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { JwtRefreshStrategy } from './auth/strategies/jwt-refresh.strategy';
import { LocalStrategy } from './auth/strategies/local.strategy';
import { CertificateStrategy } from './auth/strategies/certificate.strategy';
import { CertificateMiddleware } from './auth/middleware/certificate.middleware';
import { PollPermissionsGuard } from './auth/guards/poll-permissions.guard';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => PollsModule),
    SecurityModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn =
          configService.get<string>('JWT_EXPIRATION_TIME') ?? '3600s';

        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    CertificateStrategy,
    CertificateMiddleware,
    PollPermissionsGuard,
  ],
  exports: [
    AuthService,
    CertificateMiddleware,
    PollPermissionsGuard,
    JwtModule,
  ],
})
export class AuthModule {}
