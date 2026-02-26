import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TallyService } from './tally.service';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role, UserContext } from '../auth/auth.interfaces';
import { RateLimitGuard } from '../security/guards/rate-limit.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface EncryptRequest {
  pollId: string;
  plaintextVote: number;
}

interface StoreRequest {
  pollId: string;
  ciphertext: string;
  voteIndex: number;
  processingTime?: number;
  contextData?: string;
}

interface EncryptAndStoreRequest {
  pollId: string;
  plaintextVote: number;
  voteIndex: number;
  contextData?: string;
}

interface DecryptRequest {
  aggregateCiphertext: string;
}

@Controller('tally')
@UseGuards(RateLimitGuard)
export class TallyController {
  private readonly logger = new Logger(TallyController.name);

  constructor(private readonly tallyService: TallyService) {}

  @Post('encrypt')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async encrypt(@Body() encryptRequest: EncryptRequest) {
    this.logger.log(
      `Encrypting vote for poll ${encryptRequest.pollId || 'undefined'}`,
    );

    const result = await this.tallyService.encrypt(
      encryptRequest.pollId,
      encryptRequest.plaintextVote,
    );

    return result;
  }

  @Post('store')
  @HttpCode(201)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async storeBallot(@Body() storeRequest: StoreRequest) {
    this.logger.log(`Storing encrypted ballot for poll ${storeRequest.pollId}`);

    const result = await this.tallyService.storeBallot(
      storeRequest.pollId,
      storeRequest.ciphertext,
      storeRequest.voteIndex,
      storeRequest.processingTime,
      storeRequest.contextData,
    );

    return {
      id: result.id,
      pollId: result.pollId,
      voteIndex: result.voteIndex,
      createdAt: result.createdAt,
    };
  }

  @Post('encrypt-and-store')
  @HttpCode(201)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async encryptAndStoreVote(@Body() request: EncryptAndStoreRequest) {
    this.logger.log(`Encrypting and storing vote for poll ${request.pollId}`);

    const result = await this.tallyService.encryptAndStoreVote(
      request.pollId,
      request.plaintextVote,
      request.voteIndex,
      request.contextData,
    );

    return {
      id: result.id,
      pollId: result.pollId,
      voteIndex: result.voteIndex,
      processingTime: result.processingTime,
      createdAt: result.createdAt,
    };
  }

  @Post('aggregate/:pollId')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async aggregate(
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @GetUser() user: UserContext,
  ) {
    this.logger.log(
      `User ${user.id} requesting aggregation for poll ${pollId}`,
    );

    const result = await this.tallyService.aggregate(pollId);

    return result;
  }

  @Post('decrypt')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async decrypt(
    @Body() decryptRequest: DecryptRequest,
    @GetUser() user: UserContext,
  ) {
    this.logger.log(`User ${user.id} requesting decryption of aggregate`);

    // Note: In a real system, this would require admin privileges or threshold decryption
    const result = await this.tallyService.decryptAggregate(
      decryptRequest.aggregateCiphertext,
    );

    return result;
  }

  @Get('params/:pollId')
  @HttpCode(200)
  async getEncryptionParams(@Param('pollId', ParseUUIDPipe) pollId: string) {
    this.logger.log(`Getting encryption parameters for poll ${pollId}`);

    const result = await this.tallyService.getEncryptionParams(pollId);

    return result;
  }

  @Post('cleanup/:pollId')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async cleanupBallots(
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @GetUser() user: UserContext,
  ) {
    this.logger.log(`User ${user.id} requesting cleanup for poll ${pollId}`);

    const deletedCount = await this.tallyService.cleanupBallots(pollId);

    return { deletedCount };
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  @HttpCode(200)
  async healthCheck() {
    const ready = this.tallyService.isReady();
    return {
      ready,
      timestamp: new Date().toISOString(),
      service: 'tally',
    };
  }
}
