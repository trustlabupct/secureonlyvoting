import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PollsController, AdminPollsController } from './polls.controller';
import { PollsService } from './polls.service';
import { Poll } from './entities/poll.entity';
import { Option } from './entities/option.entity';
import { Vote } from '../votes/entities/vote.entity';
import { SecurityModule } from '../security/security.module';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Poll, Option, Vote]), SecurityModule],
  controllers: [PollsController, AdminPollsController],
  providers: [PollsService, RolesGuard],
  exports: [PollsService],
})
export class PollsModule {}
