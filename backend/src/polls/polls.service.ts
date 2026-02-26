import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Poll, PollVisibility, ShowResultsTo } from './entities/poll.entity';
import { Vote } from '../votes/entities/vote.entity';
import { Option } from './entities/option.entity';
import { CreatePollDto } from './entities/create-poll.dto';
import { UpdatePollDto } from './entities/update-poll.dto';
import { UserContext, Role } from '../auth/auth.interfaces'; // Import shared UserContext and Role

// Define the extended Poll type with permission flags
// This could also be moved to a shared types/interfaces file if used elsewhere
export type PollWithPermissions = Poll & {
  hasVoted: boolean;
  canView: boolean;
  canVote: boolean;
  showResultsRealtime: boolean;
  showResultsAfterClose: boolean;
};

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name); // Added logger

  constructor(
    @InjectRepository(Poll)
    private readonly pollRepository: Repository<Poll>,
    @InjectRepository(Vote)
    private readonly voteRepository: Repository<Vote>,
    @InjectRepository(Option)
    private readonly optionRepository: Repository<Option>,
    private readonly dataSource: DataSource,
  ) {}

  private async calculatePermissionFlags(
    poll: Poll,
    user?: UserContext,
  ): Promise<PollWithPermissions> {
    const now = new Date();
    // Ensure user.id is accessed safely, as user itself can be undefined
    const hasVoted = user?.id
      ? !!(await this.voteRepository.existsBy({
          pollId: poll.id,
          userId: user.id,
        }))
      : false;
    const isActive = poll.startTime <= now && now < poll.endTime;
    const hasEnded = now >= poll.endTime;

    let canView = false;
    const isAdmin = user?.roles?.includes(Role.ADMIN) ?? false;

    if (poll.visibility === PollVisibility.EVERYONE) {
      canView = true;
    } else if (isAdmin) {
      canView = true;
    } else if (poll.visibility === PollVisibility.ADMIN_ONLY) {
      canView = false;
    } else if (poll.visibility === PollVisibility.SPECIFIC_GROUPS) {
      // Ensure user.groups is accessed safely
      if (user?.groups && poll.allowedGroups && poll.allowedGroups.length > 0) {
        canView = poll.allowedGroups.some(
          (ag) => user.groups?.includes(ag) ?? false,
        );
      }
    }

    const canVote = canView && isActive && !hasVoted && !!user; // user must exist to vote

    let showResultsRealtime = false;
    let showResultsAfterClose = false;

    if (isAdmin) {
      showResultsRealtime = true;
      showResultsAfterClose = true;
    } else {
      if (poll.showResultsTo.includes(ShowResultsTo.ADMINS)) {
        // Covered by isAdmin
      }
      if (poll.showResultsTo.includes(ShowResultsTo.VOTERS)) {
        if (hasVoted) showResultsRealtime = true;
        if (hasEnded) showResultsAfterClose = true;
      }
      if (
        poll.showResultsTo.includes(ShowResultsTo.EVERYONE_AFTER_CLOSE) &&
        hasEnded
      ) {
        showResultsRealtime = true;
        showResultsAfterClose = true;
      }
    }

    if (!canView && !isAdmin) {
      showResultsRealtime = false;
      showResultsAfterClose = false;
    }

    return {
      ...poll,
      hasVoted,
      canView,
      canVote,
      showResultsRealtime,
      showResultsAfterClose,
    };
  }

  async findAll(user?: UserContext): Promise<PollWithPermissions[]> {
    this.logger.log(`Finding all polls for user: ${user?.id}`);
    const polls = await this.pollRepository.find({
      relations: ['options'],
      order: { createdAt: 'DESC' },
    });

    const pollsWithFlags = await Promise.all(
      polls.map((poll) => this.calculatePermissionFlags(poll, user)),
    );

    const isAdmin = user?.roles?.includes(Role.ADMIN) ?? false;
    if (isAdmin) {
      return pollsWithFlags;
    }
    return pollsWithFlags.filter((p) => p.canView);
  }

  async findOne(id: string, user?: UserContext): Promise<PollWithPermissions> {
    this.logger.log(`Finding poll ${id} for user ${user?.id}`);
    const poll = await this.pollRepository.findOne({
      where: { id },
      relations: ['options'],
    });

    if (!poll) {
      throw new NotFoundException(`Poll with ID "${id}" not found`);
    }

    const pollWithFlags = await this.calculatePermissionFlags(poll, user);
    const isAdmin = user?.roles?.includes(Role.ADMIN) ?? false;

    if (!pollWithFlags.canView && !isAdmin) {
      throw new ForbiddenException(
        `You do not have permission to view poll with ID "${id}"`,
      );
    }
    return pollWithFlags;
  }

  async getResults(
    id: string,
    user: UserContext,
  ): Promise<{ optionId: string; optionName: string; count: number }[]> {
    this.logger.log(`Getting results for poll ${id}, user ${user.id}`);
    const pollWithFlags = await this.findOne(id, user);

    const now = new Date();
    const canSeeResultsNow =
      pollWithFlags.showResultsRealtime ||
      (pollWithFlags.showResultsAfterClose && now >= pollWithFlags.endTime);

    if (!canSeeResultsNow) {
      throw new ForbiddenException(
        `You do not have permission to view the results for poll "${pollWithFlags.name}" at this time.`,
      );
    }

    const options = pollWithFlags.options;
    if (!options || options.length === 0) {
      return [];
    }

    const votes = await this.voteRepository.find({ where: { pollId: id } });
    let results: { optionId: string; optionName: string; count: number }[] = [];

    switch (pollWithFlags.votingMechanism) {
      case 'yes-no':
      case 'multiple-choice':
      case 'rating':
        const countsByOptionId = votes.reduce(
          (acc, vote) => {
            if (vote.optionId) {
              acc[vote.optionId] = (acc[vote.optionId] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>,
        );
        results = options.map((option) => ({
          optionId: option.id,
          optionName: option.name,
          count: countsByOptionId[option.id] || 0,
        }));
        break;

      case 'multiple-selection':
        const countsBySelectedOptionId = votes.reduce(
          (acc, vote) => {
            if (vote.selectedOptionIds) {
              vote.selectedOptionIds.forEach((optId) => {
                acc[optId] = (acc[optId] || 0) + 1;
              });
            }
            return acc;
          },
          {} as Record<string, number>,
        );
        results = options.map((option) => ({
          optionId: option.id,
          optionName: option.name,
          count: countsBySelectedOptionId[option.id] || 0,
        }));
        break;

      case 'ranking':
        const rankCounts = votes.reduce(
          (acc, vote) => {
            if (vote.rankedOptionIds && vote.rankedOptionIds.length > 0) {
              const firstRankedId = vote.rankedOptionIds[0];
              acc[firstRankedId] = (acc[firstRankedId] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>,
        );
        results = options.map((option) => ({
          optionId: option.id,
          optionName: option.name,
          count: rankCounts[option.id] || 0,
        }));
        break;
      case 'text-response':
        // Text responses are handled differently, not just counts per option
        // This might return an array of { userId (if not anonymous), textResponse, comment }
        // For now, let's return a simple count of text responses.
        const textResponseVotes = votes.filter(
          (v) => v.textResponse && v.textResponse.trim() !== '',
        );
        results = [
          {
            optionId: 'text_responses',
            optionName: 'Total Text Responses',
            count: textResponseVotes.length,
          },
        ];
        // A more detailed structure might be needed depending on frontend requirements
        // e.g., if (user has permission to see individual responses and poll is not anonymous)
        // results = textResponseVotes.map(v => ({ userId: v.userId, response: v.textResponse }));
        break;
      default:
        this.logger.warn(
          `Result calculation not fully implemented for mechanism: ${pollWithFlags.votingMechanism}`,
        );
        results = options.map((option) => ({
          optionId: option.id,
          optionName: option.name,
          count: 0,
        }));
    }
    return results;
  }

  async getVoteCount(
    id: string,
    user?: UserContext,
  ): Promise<{ count: number }> {
    this.logger.log(`Getting vote count for poll ${id}, user ${user?.id}`);
    // Ensure user can at least view the poll before revealing vote count
    await this.findOne(id, user);
    const count = await this.voteRepository.count({ where: { pollId: id } });
    return { count };
  }

  async create(
    createPollDto: CreatePollDto,
    user: UserContext,
  ): Promise<PollWithPermissions> {
    // Added UserContext
    this.logger.log(`User ${user.id} creating poll: ${createPollDto.name}`);
    if (!user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Only admins can create polls.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pollData: Partial<Poll> = {
        ...createPollDto,
        createdBy: user.id, // Set creator
        // Ensure dates are Date objects
        startTime: new Date(createPollDto.startTime),
        endTime: new Date(createPollDto.endTime),
        options: [], // Options will be saved separately
      };

      if (createPollDto.visibility !== PollVisibility.SPECIFIC_GROUPS) {
        pollData.allowedGroups = [];
      }

      const savedPoll = await queryRunner.manager.save(Poll, pollData);

      // Auto-generate options for yes-no polls
      if (createPollDto.votingMechanism === 'yes-no') {
        const yesOption = this.optionRepository.create({
          name: 'Yes',
          description: null,
          displayOrder: 0,
          poll: savedPoll,
        });
        const noOption = this.optionRepository.create({
          name: 'No',
          description: null,
          displayOrder: 1,
          poll: savedPoll,
        });
        const autoOptions = [yesOption, noOption];
        await queryRunner.manager.save(Option, autoOptions);
        savedPoll.options = autoOptions;
      } else if (createPollDto.options && createPollDto.options.length > 0) {
        const optionsToSave = createPollDto.options.map((optDto, index) =>
          this.optionRepository.create({
            ...optDto,
            displayOrder: index,
            poll: savedPoll,
          }),
        );
        await queryRunner.manager.save(Option, optionsToSave);
        savedPoll.options = optionsToSave; // Assign back for the return value
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Poll ${savedPoll.id} created successfully by user ${user.id}`,
      );
      // Re-fetch to include relations correctly (especially if options were just saved)
      return this.findOne(savedPoll.id, user);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating poll: ${error.message}`, error.stack);
      if (error.code === '23505') {
        // Unique constraint violation
        throw new ConflictException(
          'A poll with similar identifying characteristics already exists.',
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    id: string,
    updatePollDto: UpdatePollDto,
    user: UserContext,
  ): Promise<PollWithPermissions> {
    // Added UserContext
    this.logger.log(`User ${user.id} updating poll ${id}`);
    if (!user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Only admins can update polls.');
    }

    const pollToUpdate = await this.pollRepository.findOne({
      where: { id },
      relations: ['options'],
    });
    if (!pollToUpdate) {
      throw new NotFoundException(`Poll with ID "${id}" not found.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update basic poll properties
      const { options, ...basicPollData } = updatePollDto;
      queryRunner.manager.merge(Poll, pollToUpdate, basicPollData);

      if (updatePollDto.startTime)
        pollToUpdate.startTime = new Date(updatePollDto.startTime);
      if (updatePollDto.endTime)
        pollToUpdate.endTime = new Date(updatePollDto.endTime);

      if (pollToUpdate.visibility !== PollVisibility.SPECIFIC_GROUPS) {
        pollToUpdate.allowedGroups = [];
      } else if (updatePollDto.allowedGroups === null) {
        // Explicitly set to empty array if null provided
        pollToUpdate.allowedGroups = [];
      }

      // Handle options: identify new, updated, and deleted options
      if (options) {
        const optionsToUpdate: Option[] = [];
        const optionsToAdd: Option[] = [];
        const optionIdsToDelete: string[] = [];

        // Current option IDs from DB
        const currentOptionIds = pollToUpdate.options.map((opt) => opt.id);
        // Option IDs from DTO
        const dtoOptionIds = options
          .map((opt) => opt.id)
          .filter((id) => !!id) as string[];

        // Identify options to delete
        currentOptionIds.forEach((currentId) => {
          if (!dtoOptionIds.includes(currentId)) {
            optionIdsToDelete.push(currentId);
          }
        });

        for (const [displayOrder, optDto] of options.entries()) {
          if (optDto.id && currentOptionIds.includes(optDto.id)) {
            // Existing option, update it
            const existingOption = pollToUpdate.options.find(
              (opt) => opt.id === optDto.id,
            );
            if (existingOption) {
              queryRunner.manager.merge(Option, existingOption, optDto);
              existingOption.displayOrder = displayOrder;
              optionsToUpdate.push(existingOption);
            }
          } else {
            // New option, add it
            const newOption = this.optionRepository.create({
              ...optDto,
              displayOrder,
              poll: pollToUpdate,
            });
            optionsToAdd.push(newOption);
          }
        }

        // Perform database operations for options
        if (optionIdsToDelete.length > 0) {
          await queryRunner.manager.delete(Option, {
            id: In(optionIdsToDelete),
            pollId: id,
          });
        }
        if (optionsToUpdate.length > 0) {
          await queryRunner.manager.save(Option, optionsToUpdate);
        }
        if (optionsToAdd.length > 0) {
          await queryRunner.manager.save(Option, optionsToAdd);
        }
      }

      await queryRunner.manager.save(Poll, pollToUpdate);
      await queryRunner.commitTransaction();
      this.logger.log(`Poll ${id} updated successfully by user ${user.id}`);
      return this.findOne(id, user); // Re-fetch to get the updated entity with all relations and permissions
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error updating poll ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, user: UserContext): Promise<void> {
    // Added UserContext
    this.logger.log(`User ${user.id} attempting to delete poll ${id}`);
    if (!user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Only admins can delete polls.');
    }
    const result = await this.pollRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Poll with ID "${id}" not found`);
    }
    this.logger.log(`Poll ${id} deleted successfully by user ${user.id}`);
  }
}
