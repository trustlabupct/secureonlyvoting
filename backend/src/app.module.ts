import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth.module';
import { UsersModule } from './users.module';
import { PollsModule } from './polls/polls.module';
import { VotesModule } from './votes/votes.module';
import { SecurityModule } from './security/security.module';
import { BlindTokensModule } from './blind-tokens/blind-tokens.module';
import { TallyModule } from './tally/tally.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigService available globally
      envFilePath: '.env', // Specify the .env file path
    }),
    ScheduleModule.forRoot(), // Enable scheduling globally
    SecurityModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') || 'localhost',
        port: configService.get<number>('DB_PORT') || 5432,
        username: configService.get<string>('DB_USERNAME') || 'postgres',
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE') || 'voting_system',
        autoLoadEntities: true, // Automatically load entities defined via forFeature()
        synchronize: false, // IMPORTANT: Set to false in production! Use migrations instead.
        logging: configService.get('NODE_ENV') === 'development', // Log SQL queries in dev
        ssl:
          configService.get('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    AuthModule,
    UsersModule,
    PollsModule,
    VotesModule,
    BlindTokensModule,
    TallyModule,
  ],
  controllers: [
    AppController,
    // Controllers from feature modules are typically not declared here
  ],
  providers: [
    AppService,
    // Providers from feature modules are typically not declared here
  ],
})
export class AppModule {}
