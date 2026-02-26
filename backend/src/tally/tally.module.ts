import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TallyController } from './tally.controller';
import { TallyService } from './tally.service';
import { EncryptedBallot } from './entities/encrypted-ballot.entity';
import { Poll } from '../polls/entities/poll.entity';
import { SecurityModule } from '../security/security.module';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([EncryptedBallot, Poll]), SecurityModule],
  controllers: [TallyController],
  providers: [TallyService, RolesGuard],
  exports: [TallyService],
})
export class TallyModule {}
