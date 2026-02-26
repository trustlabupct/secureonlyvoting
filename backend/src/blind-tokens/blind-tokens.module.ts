import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BlindTokensController } from './blind-tokens.controller';
import { BlindTokensService } from './blind-tokens.service';
import { BlindToken } from './entities/blind-token.entity';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlindToken]),
    ConfigModule,
    SecurityModule,
  ],
  controllers: [BlindTokensController],
  providers: [BlindTokensService],
  exports: [BlindTokensService],
})
export class BlindTokensModule {
  constructor() {
    console.log('🔑 BlindTokensModule has been instantiated');
  }
}
