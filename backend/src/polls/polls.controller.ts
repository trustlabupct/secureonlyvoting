import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
  Logger, // Removed Request import
} from '@nestjs/common';
import { PollsService, PollWithPermissions } from './polls.service'; // Service from the same directory
import { Poll } from './entities/poll.entity';
import { AuthGuard } from '@nestjs/passport';
import { CreatePollDto } from './entities/create-poll.dto';
import { UpdatePollDto } from './entities/update-poll.dto';
import { RolesGuard } from '../auth/guards/roles.guard'; // Adjusted path
import { Roles } from '../auth/decorators/roles.decorator'; // Adjusted path
import { PollPermissionsGuard } from '../auth/guards/poll-permissions.guard'; // Adjusted path
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserContext, Role } from '../auth/auth.interfaces'; // Import shared UserContext and Role
import {
  UseRateLimitPolicy,
  RateLimitGuard,
} from '../security/guards/rate-limit.guard';

@Controller('polls')
@UseGuards(RateLimitGuard) // Apply rate limiting to all poll endpoints
@UseRateLimitPolicy() // Use policy-driven rate limiting
export class PollsController {
  private readonly logger = new Logger(PollsController.name);

  constructor(private readonly pollsService: PollsService) {}

  @Get() // Policy: GET:/polls - 20 requests per minute
  @UseGuards(AuthGuard('jwt')) // Optional: could use OptionalJwtAuthGuard if public view is desired
  async findAll(@GetUser() user?: UserContext): Promise<PollWithPermissions[]> {
    // Use @GetUser(), make user optional
    this.logger.log(
      `Fetching all polls, user context: ${JSON.stringify(user)}`,
    );
    return this.pollsService.findAll(user);
  }

  @Get(':id') // Policy: GET:/polls/:id - 30 requests per minute
  @UseGuards(AuthGuard('jwt'), PollPermissionsGuard)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: UserContext, // Use @GetUser() decorator
  ): Promise<PollWithPermissions> {
    this.logger.log(
      `Fetching poll with id: ${id}, user context: ${JSON.stringify(user)}`,
    );
    return this.pollsService.findOne(id, user);
  }

  @Get(':id/results') // Policy: GET:/polls/:id/results - 15 requests per minute
  @UseGuards(AuthGuard('jwt'), PollPermissionsGuard)
  async getResults(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: UserContext, // Use @GetUser() decorator
  ): Promise<{ optionId: string; optionName: string; count: number }[]> {
    this.logger.log(
      `Fetching results for poll id: ${id}, user context: ${JSON.stringify(user)}`,
    );
    return this.pollsService.getResults(id, user);
  }

  @Get(':id/vote-count') // Policy: GET:/polls/:id/vote-count - 25 requests per minute
  @UseGuards(AuthGuard('jwt'), PollPermissionsGuard)
  async getVoteCount(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: UserContext, // Use @GetUser() decorator
  ): Promise<{ count: number }> {
    this.logger.log(
      `Fetching vote count for poll id: ${id}, user context: ${JSON.stringify(user)}`,
    );
    return this.pollsService.getVoteCount(id, user);
  }

  // Admin endpoints with separate controller path for better policy matching
}

@Controller('admin/polls')
@UseGuards(RateLimitGuard, AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
@UseRateLimitPolicy() // Use policy-driven rate limiting for admin endpoints
export class AdminPollsController {
  private readonly logger = new Logger(AdminPollsController.name);

  constructor(private readonly pollsService: PollsService) {}

  @Post() // Policy: POST:/admin/polls - 5 creations per 5 minutes
  async create(
    @Body() createPollDto: CreatePollDto,
    @GetUser() user: UserContext,
  ): Promise<PollWithPermissions> {
    this.logger.log(
      `Poll being created by admin user: ${user.id}, payload: ${JSON.stringify(createPollDto)}`,
    );
    return this.pollsService.create(createPollDto, user);
  }

  @Patch(':id') // Policy: PUT:/admin/polls/:id - 10 updates per 5 minutes
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePollDto: UpdatePollDto,
    @GetUser() user: UserContext,
  ): Promise<PollWithPermissions> {
    this.logger.log(`Poll ${id} being updated by admin user: ${user.id}`);
    return this.pollsService.update(id, updatePollDto, user);
  }

  @Delete(':id') // Policy: DELETE:/admin/polls/:id - 3 deletions per 5 minutes
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: UserContext,
  ): Promise<void> {
    this.logger.log(`Poll ${id} being deleted by admin user: ${user.id}`);
    return this.pollsService.remove(id, user);
  }
}
