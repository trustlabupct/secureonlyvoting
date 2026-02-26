import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Get,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { VotesService } from './votes.service';
import { CreateVoteDto } from './dto/create-vote.dto';
import { GetOptionalUser, GetUser } from '../auth/decorators/get-user.decorator';
import { UserContext } from '../auth/auth.interfaces';
import { Vote } from './entities/vote.entity';
import {
  UseRateLimitPolicy,
  RateLimitGuard,
} from '../security/guards/rate-limit.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';

@Controller('votes') // Simplified route structure for policy matching
@UseGuards(RateLimitGuard) // Apply rate limiting to all voting endpoints
@UseRateLimitPolicy() // Use policy-driven rate limiting
export class VotesController {
  private readonly logger = new Logger(VotesController.name);

  constructor(private readonly votesService: VotesService) {}

  @UseGuards(OptionalJwtAuthGuard) // Allow both authenticated and anonymous users
  @Post() // Policy: POST:/votes - 10 submissions per minute
  async submitVote(
    @Body() createVoteDto: CreateVoteDto & { pollId: string }, // Include pollId in DTO
    @GetOptionalUser() user?: UserContext, // User is optional for anonymous voting
  ): Promise<Vote> {
    if (user) {
      this.logger.log(
        `User ${user.id} submitting vote for poll ${createVoteDto.pollId}`,
      );
    } else {
      this.logger.log(
        `Anonymous user submitting vote for poll ${createVoteDto.pollId}`,
      );
    }

    return this.votesService.create(createVoteDto.pollId, createVoteDto, user);
  }

  @UseGuards(AuthGuard('jwt')) // Ensure user is authenticated
  @Get('check') // Policy: GET:/votes/check - 15 requests per minute
  async getMyVote(
    @Body() checkVoteDto: { pollId: string }, // Poll ID in request body for check
    @GetUser() user: UserContext, // Use the @GetUser() decorator
  ): Promise<Vote | null> {
    this.logger.log(
      `User ${user.id} checking their vote for poll ${checkVoteDto.pollId}`,
    );
    const vote = await this.votesService.findVoteByUserAndPoll(
      user.id,
      checkVoteDto.pollId,
    );
    if (!vote) {
      this.logger.log(
        `No vote found for user ${user.id} on poll ${checkVoteDto.pollId}`,
      );
      return null;
    }
    return vote;
  }

  @UseGuards(AuthGuard('jwt')) // Ensure user is authenticated
  @Get('history') // Policy: GET:/votes/history - 15 requests per minute
  async getVotingHistory(
    @GetUser() user: UserContext, // Use the @GetUser() decorator
  ): Promise<any[]> {
    this.logger.log(`User ${user.id} fetching voting history`);
    return this.votesService.findVotingHistoryByUser(user.id);
  }
}
