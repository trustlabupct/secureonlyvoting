import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PollsService } from '../../polls/polls.service';
import { Reflector } from '@nestjs/core';
import { UserContext, RequestWithUser } from '../auth.interfaces';
import { isUUID } from 'class-validator';

@Injectable()
export class PollPermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector, // Currently unused but kept for future metadata-based actions
    private pollsService: PollsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const rawPollId = request.params.id || request.params.pollId; // Accommodate :id or :pollId
    const pollId = Array.isArray(rawPollId) ? rawPollId[0] : rawPollId;

    if (!pollId) {
      throw new BadRequestException('Poll ID is required.');
    }

    if (!isUUID(pollId)) {
      throw new BadRequestException('Invalid Poll ID format.');
    }

    if (!user) {
      // This guard typically runs after a JWT auth guard. If user is not present, it's an issue.
      throw new ForbiddenException('Authentication required for this action.');
    }

    try {
      // findOne in PollsService is expected to handle initial permission checks (e.g., visibility)
      // and throw NotFoundException or ForbiddenException if the user cannot access the poll.
      const pollWithFlags = await this.pollsService.findOne(pollId, user);

      // Attach the loaded poll (with permission flags) to the request object
      // so that the controller/handler can use it without re-fetching.
      request.poll = pollWithFlags;

      // At this point, the user has at least basic view access to the poll.
      // More specific action-based permissions (e.g., canVote, canViewResults)
      // would ideally be checked here based on route metadata (if using @Action decorator)
      // or handled within the PollsService methods called by the controller.
      // For now, succeeding means basic access is granted.
      return true;
    } catch (error) {
      // Re-throw known exceptions from PollsService to maintain original error status and message.
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      // For other unexpected errors, log and throw a generic ForbiddenException.
      console.error('[PollPermissionsGuard] Unexpected error:', error);
      throw new ForbiddenException(
        'An error occurred while checking poll permissions.',
      );
    }
  }
}
