import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vote } from './entities/vote.entity';
import { VotesService } from './votes.service';
import { VotesController } from './votes.controller';
import { PollsModule } from '../polls/polls.module';
import { SecurityModule } from '../security/security.module';
import { BlindTokensModule } from '../blind-tokens/blind-tokens.module';
import { Poll } from '../polls/entities/poll.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vote, Poll]),
    PollsModule,
    SecurityModule,
    BlindTokensModule,
  ],
  controllers: [VotesController],
  providers: [VotesService],
  exports: [VotesService],
})
export class VotesModule {}
