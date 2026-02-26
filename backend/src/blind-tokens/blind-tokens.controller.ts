import {
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BlindTokensService } from './blind-tokens.service';
import { AuthGuard } from '@nestjs/passport';
import { RateLimitGuard } from '../security/guards/rate-limit.guard';

@Controller('blind-tokens')
@UseGuards(RateLimitGuard)
export class BlindTokensController {
  private readonly logger = new Logger(BlindTokensController.name);

  constructor(private readonly blindTokensService: BlindTokensService) {
    console.log('🎮 BlindTokensController has been instantiated');
  }

  @Post('generate')
  @UseGuards(AuthGuard('jwt'))
  async generateBlindToken(@Request() req) {
    try {
      const userId = req.user.id;
      this.logger.log(`Generating blind token for user: ${userId}`);

      const result = await this.blindTokensService.generateBlindToken(userId);

      return {
        statusCode: HttpStatus.CREATED,
        message: 'Blind token generated successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error generating blind token: ${error.message}`);
      throw error;
    }
  }

  @Get('public-key')
  async getPublicKey() {
    try {
      const publicKey = this.blindTokensService.getPublicKey();

      return {
        statusCode: HttpStatus.OK,
        message: 'Public key retrieved successfully',
        data: { publicKey },
      };
    } catch (error) {
      this.logger.error(`Error retrieving public key: ${error.message}`);
      throw error;
    }
  }

  @Get('my-tokens')
  @UseGuards(AuthGuard('jwt'))
  async getMyActiveTokens(@Request() req) {
    try {
      const userId = req.user.id;
      const tokens = await this.blindTokensService.getUserActiveTokens(userId);

      return {
        statusCode: HttpStatus.OK,
        message: 'Active tokens retrieved successfully',
        data: tokens.map((token) => ({
          id: token.id,
          used: token.used,
          expiresAt: token.expiresAt,
          createdAt: token.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error(`Error retrieving active tokens: ${error.message}`);
      throw error;
    }
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async getOrCreateBlindToken(@Request() req) {
    try {
      const userId = req.user.id;
      this.logger.log(`Getting or creating blind token for user: ${userId}`);

      // First check for existing unused tokens
      const activeTokens =
        await this.blindTokensService.getUserActiveTokens(userId);
      const unusedToken = activeTokens.find((token) => !token.used);

      if (unusedToken) {
        this.logger.log(`Using existing blind token: ${unusedToken.id}`);
        return {
          statusCode: HttpStatus.OK,
          message: 'Using existing blind token',
          data: { id: unusedToken.id },
        };
      }

      // If no unused tokens, generate a new one
      this.logger.log('No unused tokens found, generating new blind token...');
      const result = await this.blindTokensService.generateBlindToken(userId);

      return {
        statusCode: HttpStatus.CREATED,
        message: 'New blind token created successfully',
        data: { id: result.blindTokenId },
      };
    } catch (error) {
      this.logger.error(
        `Error getting or creating blind token: ${error.message}`,
      );
      throw error;
    }
  }
}
