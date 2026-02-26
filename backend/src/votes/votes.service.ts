import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vote } from './entities/vote.entity';
import { CreateVoteDto } from './dto/create-vote.dto';
import { UserContext } from '../auth/auth.interfaces';
import { PollsService } from '../polls/polls.service';
import { Poll } from '../polls/entities/poll.entity';
import { sanitizeText } from '../common/sanitizer';
import { BlindTokensService } from '../blind-tokens/blind-tokens.service';

@Injectable()
export class VotesService {
  private readonly logger = new Logger(VotesService.name);

  constructor(
    @InjectRepository(Vote)
    private votesRepository: Repository<Vote>,
    @InjectRepository(Poll)
    private pollRepository: Repository<Poll>,
    private pollsService: PollsService,
    private blindTokensService: BlindTokensService,
  ) {}

  async create(
    pollId: string,
    createVoteDto: CreateVoteDto,
    user?: UserContext,
  ): Promise<Vote> {
    // 1. Fetch poll to check if it's anonymous
    const poll = await this.getPollEntity(pollId);
    if (!poll) {
      throw new NotFoundException(`Poll with ID "${pollId}" not found.`);
    }

    this.validateVotePayloadForPoll(poll, createVoteDto);

    // 2. Handle anonymous vs authenticated voting
    if (poll.anonymous) {
      return this.createAnonymousVote(pollId, createVoteDto, poll);
    } else {
      if (!user) {
        throw new BadRequestException(
          'Authentication required for non-anonymous polls',
        );
      }
      return this.createAuthenticatedVote(pollId, createVoteDto, user, poll);
    }
  }

  private async createAuthenticatedVote(
    pollId: string,
    createVoteDto: CreateVoteDto,
    user: UserContext,
    poll: Poll,
  ): Promise<Vote> {
    this.logger.log(
      `Attempting to create authenticated vote for poll ${pollId} by user ${user.id}`,
    );

    // 1. Fetch poll details & check permissions
    const pollDetails = await this.pollsService.findOne(pollId, user);
    if (!pollDetails) {
      throw new NotFoundException(`Poll with ID "${pollId}" not found.`);
    }
    if (!pollDetails.canVote) {
      let reason = 'Voting is not allowed for this poll at this time.';
      if (pollDetails.hasVoted) reason = 'User has already voted in this poll.';
      throw new ForbiddenException(reason);
    }

    // 2. Check for existing vote again (safeguard)
    const existingVote = await this.votesRepository.findOne({
      where: { pollId, userId: user.id },
    });
    if (existingVote) {
      throw new ForbiddenException(
        'User has already voted in this poll (direct check).',
      );
    }

    // 3. Sanitize textResponse
    let sanitizedTextResponse: string | undefined = undefined;
    if (
      createVoteDto.textResponse !== undefined &&
      createVoteDto.textResponse !== null
    ) {
      const originalText = createVoteDto.textResponse;
      sanitizedTextResponse = sanitizeText(originalText);
      if (sanitizedTextResponse !== originalText) {
        this.logger.warn(
          `Sanitization altered textResponse for poll ${pollId}, user ${user.id}.`,
        );
      }
      if (sanitizedTextResponse.length === 0) {
        sanitizedTextResponse = undefined; // Treat sanitized empty string as no response
      }
    }

    // 4. Create Vote entity
    const vote = this.votesRepository.create({
      ...createVoteDto,
      textResponse: sanitizedTextResponse, // Use potentially sanitized value
      pollId: pollId,
      userId: user.id,
    });

    // 5. Save Vote
    try {
      const savedVote = await this.votesRepository.save(vote);
      this.logger.log(
        `Vote successfully cast for poll ${pollId} by user ${user.id}, vote ID: ${savedVote.id}`,
      );
      // Log sanitized length (if it exists) - Part of Step 7
      if (sanitizedTextResponse !== undefined) {
        this.logger.log(
          `Sanitized textResponse length for vote ${savedVote.id}: ${sanitizedTextResponse.length}`,
        );
      }
      return savedVote;
    } catch (error) {
      if (error.code === '23505') {
        // PostgreSQL unique violation code
        this.logger.warn(
          `Unique constraint violation for poll ${pollId}, user ${user.id}: ${error.message}`,
        );
        throw new ForbiddenException(
          'This vote would violate a unique constraint (e.g., already voted).',
        );
      }
      this.logger.error(
        `Error saving vote for poll ${pollId}, user ${user.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Placeholder for other methods if needed
  async findVotesByPoll(pollId: string): Promise<Vote[]> {
    return this.votesRepository.find({ where: { pollId } });
  }

  async findVoteByUserAndPoll(
    userId: string,
    pollId: string,
  ): Promise<Vote | null> {
    this.logger.log(`Finding vote by user ${userId} for poll ${pollId}`);
    return this.votesRepository.findOne({ where: { userId, pollId } });
  }

  async findVotingHistoryByUser(userId: string): Promise<any[]> {
    this.logger.log(`Finding voting history for user ${userId}`);

    // Join with polls to get poll information
    const votesWithPolls = await this.votesRepository
      .createQueryBuilder('vote')
      .leftJoinAndSelect('vote.poll', 'poll')
      .where('vote.userId = :userId', { userId })
      .orderBy('vote.createdAt', 'DESC')
      .getMany();

    // Transform the data to match the frontend interface
    return votesWithPolls.map((vote) => ({
      id: vote.poll?.id || vote.pollId,
      title: vote.poll?.name || 'Unknown Poll',
      votedAt: vote.createdAt,
      status: this.getPollStatus(vote.poll),
    }));
  }

  private getPollStatus(poll: Poll | null): 'active' | 'closed' | 'draft' {
    if (!poll) return 'closed';

    const now = new Date();
    const startTime = new Date(poll.startTime);
    const endTime = new Date(poll.endTime);

    if (now < startTime) return 'draft';
    if (now > endTime) return 'closed';
    return 'active';
  }

  private async getPollEntity(pollId: string): Promise<Poll | null> {
    return this.pollRepository.findOne({
      where: { id: pollId },
      relations: ['options'],
    });
  }

  private validateVotePayloadForPoll(
    poll: Poll,
    createVoteDto: CreateVoteDto,
  ): void {
    const hasOptionId = !!createVoteDto.optionId;
    const hasSelectedOptions =
      Array.isArray(createVoteDto.selectedOptionIds) &&
      createVoteDto.selectedOptionIds.length > 0;
    const hasRankedOptions =
      Array.isArray(createVoteDto.rankedOptionIds) &&
      createVoteDto.rankedOptionIds.length > 0;
    const hasRating =
      createVoteDto.ratingValue !== undefined &&
      createVoteDto.ratingValue !== null;
    const hasTextResponse =
      typeof createVoteDto.textResponse === 'string' &&
      createVoteDto.textResponse.trim().length > 0;

    const answerFieldsCount = [
      hasOptionId,
      hasSelectedOptions,
      hasRankedOptions,
      hasRating,
      hasTextResponse,
    ].filter(Boolean).length;

    if (answerFieldsCount === 0) {
      throw new BadRequestException(
        'Vote payload does not contain a valid answer.',
      );
    }

    if (
      createVoteDto.comment !== undefined &&
      createVoteDto.comment !== null &&
      createVoteDto.comment.trim().length > 0 &&
      !poll.allowComments
    ) {
      throw new BadRequestException('Comments are not allowed for this poll.');
    }

    const pollOptionIds = new Set((poll.options ?? []).map((option) => option.id));
    const assertOptionIdBelongsToPoll = (optionId: string, field: string) => {
      if (!pollOptionIds.has(optionId)) {
        throw new BadRequestException(
          `Invalid ${field}: option "${optionId}" does not belong to poll "${poll.id}".`,
        );
      }
    };

    const assertNoDuplicateIds = (ids: string[], field: string) => {
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException(`Duplicate option IDs are not allowed in ${field}.`);
      }
    };

    switch (poll.votingMechanism) {
      case 'yes-no':
      case 'multiple-choice': {
        if (!hasOptionId) {
          throw new BadRequestException(
            `Field "optionId" is required for "${poll.votingMechanism}" polls.`,
          );
        }
        if (hasSelectedOptions || hasRankedOptions || hasRating || hasTextResponse) {
          throw new BadRequestException(
            `Only "optionId" is allowed for "${poll.votingMechanism}" polls.`,
          );
        }
        assertOptionIdBelongsToPoll(createVoteDto.optionId!, 'optionId');
        return;
      }

      case 'multiple-selection': {
        if (!hasSelectedOptions) {
          throw new BadRequestException(
            'Field "selectedOptionIds" is required for "multiple-selection" polls.',
          );
        }
        if (hasOptionId || hasRankedOptions || hasRating || hasTextResponse) {
          throw new BadRequestException(
            'Only "selectedOptionIds" is allowed for "multiple-selection" polls.',
          );
        }
        const selected = createVoteDto.selectedOptionIds!;
        assertNoDuplicateIds(selected, 'selectedOptionIds');
        selected.forEach((optionId) =>
          assertOptionIdBelongsToPoll(optionId, 'selectedOptionIds'),
        );
        return;
      }

      case 'ranking': {
        if (!hasRankedOptions) {
          throw new BadRequestException(
            'Field "rankedOptionIds" is required for "ranking" polls.',
          );
        }
        if (hasOptionId || hasSelectedOptions || hasRating || hasTextResponse) {
          throw new BadRequestException(
            'Only "rankedOptionIds" is allowed for "ranking" polls.',
          );
        }
        const ranked = createVoteDto.rankedOptionIds!;
        assertNoDuplicateIds(ranked, 'rankedOptionIds');
        ranked.forEach((optionId) =>
          assertOptionIdBelongsToPoll(optionId, 'rankedOptionIds'),
        );
        if (poll.options?.length && ranked.length !== poll.options.length) {
          throw new BadRequestException(
            'Ranking polls require ranking all available options exactly once.',
          );
        }
        return;
      }

      case 'rating': {
        if (!hasRating) {
          throw new BadRequestException(
            'Field "ratingValue" is required for "rating" polls.',
          );
        }
        if (hasOptionId || hasSelectedOptions || hasRankedOptions || hasTextResponse) {
          throw new BadRequestException(
            'Only "ratingValue" is allowed for "rating" polls.',
          );
        }

        if (!poll.ratingScale) {
          throw new BadRequestException(
            'This rating poll is misconfigured: missing rating scale.',
          );
        }

        const ratingValue = createVoteDto.ratingValue!;
        const { min, max, step = 1 } = poll.ratingScale;

        if (ratingValue < min || ratingValue > max) {
          throw new BadRequestException(
            `Rating value must be between ${min} and ${max}.`,
          );
        }

        const stepIndex = (ratingValue - min) / step;
        const isStepAligned = Math.abs(stepIndex - Math.round(stepIndex)) < 1e-9;
        if (!isStepAligned) {
          throw new BadRequestException(
            `Rating value must align with configured step ${step}.`,
          );
        }
        return;
      }

      case 'text-response': {
        if (!hasTextResponse) {
          throw new BadRequestException(
            'Field "textResponse" is required for "text-response" polls.',
          );
        }
        if (hasOptionId || hasSelectedOptions || hasRankedOptions || hasRating) {
          throw new BadRequestException(
            'Only "textResponse" is allowed for "text-response" polls.',
          );
        }
        return;
      }

      default:
        throw new BadRequestException(
          `Unsupported voting mechanism "${poll.votingMechanism}".`,
        );
    }
  }

  private async createAnonymousVote(
    pollId: string,
    createVoteDto: CreateVoteDto,
    poll: Poll,
  ): Promise<Vote> {
    this.logger.log(`Attempting to create anonymous vote for poll ${pollId}`);

    // 1. Validate blind token if provided
    if (!createVoteDto.blindTokenId) {
      throw new BadRequestException(
        'Blind token ID is required for anonymous voting',
      );
    }

    // 2. Validate and use the blind token
    const blindToken = await this.blindTokensService.validateAndUseBlindToken(
      createVoteDto.blindTokenId,
      pollId,
    );

    // 3. Check poll timing
    const now = new Date();
    if (now < poll.startTime) {
      throw new ForbiddenException('Voting has not started yet');
    }
    if (now > poll.endTime) {
      throw new ForbiddenException('Voting has ended');
    }

    // 4. Check for existing vote with this blind token
    const existingVote = await this.votesRepository.findOne({
      where: { pollId, blindTokenId: createVoteDto.blindTokenId },
    });
    if (existingVote) {
      throw new ForbiddenException(
        'This blind token has already been used to vote in this poll',
      );
    }

    // 5. Sanitize textResponse
    let sanitizedTextResponse: string | undefined = undefined;
    if (
      createVoteDto.textResponse !== undefined &&
      createVoteDto.textResponse !== null
    ) {
      const originalText = createVoteDto.textResponse;
      sanitizedTextResponse = sanitizeText(originalText);
      if (sanitizedTextResponse !== originalText) {
        this.logger.warn(
          `Sanitization altered textResponse for anonymous poll ${pollId}.`,
        );
      }
      if (sanitizedTextResponse.length === 0) {
        sanitizedTextResponse = undefined;
      }
    }

    // 6. Create Vote entity (anonymous)
    const vote = this.votesRepository.create({
      ...createVoteDto,
      textResponse: sanitizedTextResponse,
      pollId: pollId,
      blindTokenId: createVoteDto.blindTokenId,
      userId: null, // No user ID for anonymous votes
    });

    // 7. Save Vote
    try {
      const savedVote = await this.votesRepository.save(vote);
      this.logger.log(
        `Anonymous vote successfully cast for poll ${pollId}, vote ID: ${savedVote.id}`,
      );

      if (sanitizedTextResponse !== undefined) {
        this.logger.log(
          `Sanitized textResponse length for anonymous vote ${savedVote.id}: ${sanitizedTextResponse.length}`,
        );
      }

      return savedVote;
    } catch (error) {
      if (error.code === '23505') {
        this.logger.warn(
          `Unique constraint violation for anonymous poll ${pollId}: ${error.message}`,
        );
        throw new ForbiddenException(
          'This vote would violate a unique constraint',
        );
      }
      this.logger.error(
        `Error saving anonymous vote for poll ${pollId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
