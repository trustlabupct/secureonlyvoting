import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptedBallot } from './entities/encrypted-ballot.entity';
import { Poll } from '../polls/entities/poll.entity';
import { SecurityService } from '../security/security.service';

// Use require() to get the CJS export which is a function
const SEAL = require('node-seal');

@Injectable()
export class TallyService implements OnModuleInit {
  private readonly logger = new Logger(TallyService.name);
  private seal: any;
  private context: any;
  private encoder: any;
  private keyGenerator: any;
  private publicKey: any;
  private secretKey: any;
  private encryptor: any;
  private decryptor: any;
  private evaluator: any;
  private encryptionParameters: any;

  constructor(
    @InjectRepository(EncryptedBallot)
    private encryptedBallotRepository: Repository<EncryptedBallot>,
    @InjectRepository(Poll)
    private pollRepository: Repository<Poll>,
    private securityService: SecurityService,
  ) {}

  async onModuleInit() {
    try {
      this.logger.log(
        'Initializing SEAL library for homomorphic encryption...',
      );

      // Initialize SEAL - now SEAL is actually a function you can await
      this.seal = await SEAL();

      // Set up encryption parameters for BFV scheme (supports integer arithmetic)
      this.encryptionParameters = this.seal.EncryptionParameters(
        this.seal.SchemeType.bfv,
      );

      // Set the polynomial modulus degree (power of 2)
      this.encryptionParameters.setPolyModulusDegree(4096);

      // Set the coefficient modulus
      this.encryptionParameters.setCoeffModulus(
        this.seal.CoeffModulus.BFVDefault(4096),
      );

      // Set the plaintext modulus using BatchEncoder approach
      this.encryptionParameters.setPlainModulus(
        this.seal.PlainModulus.Batching(4096, 20),
      );

      // Create SEALContext
      this.context = this.seal.Context(
        this.encryptionParameters,
        true,
        this.seal.SecurityLevel.tc128,
      );

      // Verify context is valid
      if (!this.context.parametersSet()) {
        throw new Error('SEAL context parameters not set correctly');
      }

      // Set up encoder for batch encoding (works with arrays)
      this.encoder = this.seal.BatchEncoder(this.context);

      // Generate keys
      this.keyGenerator = this.seal.KeyGenerator(this.context);
      this.publicKey = this.keyGenerator.createPublicKey();
      this.secretKey = this.keyGenerator.secretKey();

      // Create encryptor and decryptor
      this.encryptor = this.seal.Encryptor(this.context, this.publicKey);
      this.decryptor = this.seal.Decryptor(this.context, this.secretKey);

      // Create evaluator for homomorphic operations
      this.evaluator = this.seal.Evaluator(this.context);

      this.logger.log('SEAL library initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize SEAL library: ${error.message}`);
      throw error;
    }
  }

  /**
   * Encrypt a plaintext vote value (0 or 1 for yes/no, or integer choice)
   */
  async encrypt(
    pollId: string,
    plaintextVote: number,
  ): Promise<{ ciphertext: string; processingTime: number }> {
    const startTime = Date.now();

    try {
      // Validate inputs
      if (!pollId) {
        throw new BadRequestException('Poll ID is required');
      }

      if (typeof plaintextVote !== 'number' || plaintextVote < 0) {
        throw new BadRequestException('Invalid plaintext vote value');
      }

      if (!this.isReady()) {
        throw new BadRequestException('SEAL library not properly initialized');
      }

      // Fetch poll and validate it supports homomorphic encryption
      const poll = await this.pollRepository.findOne({ where: { id: pollId } });
      if (!poll) {
        throw new BadRequestException('Poll not found');
      }

      if (!poll.anonymous) {
        throw new BadRequestException(
          'Homomorphic encryption only available for anonymous polls',
        );
      }

      // Encode plaintext vote
      const plaintextArray = new Uint32Array([plaintextVote]);
      const plaintext = this.seal.PlainText();
      this.encoder.encode(plaintextArray, plaintext);

      // Encrypt the plaintext
      const ciphertext = this.seal.CipherText();
      this.encryptor.encrypt(plaintext, ciphertext);

      // Serialize ciphertext for storage
      const ciphertextString = ciphertext.save();

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Encrypted vote ${plaintextVote} for poll ${pollId} in ${processingTime}ms`,
      );

      return {
        ciphertext: ciphertextString,
        processingTime,
      };
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store an encrypted ballot
   */
  async storeBallot(
    pollId: string,
    ciphertext: string,
    voteIndex: number,
    processingTime?: number,
    contextData?: string,
  ): Promise<EncryptedBallot> {
    try {
      const encryptedBallot = this.encryptedBallotRepository.create({
        pollId,
        ciphertext,
        voteIndex,
        processingTime: processingTime || null,
        contextData: contextData || null,
      });

      const savedBallot =
        await this.encryptedBallotRepository.save(encryptedBallot);

      // Track ballot storage in metrics
      await this.securityService.incrementMetric('encrypted_ballots_stored');

      this.logger.log(
        `Stored encrypted ballot for poll ${pollId}, vote index ${voteIndex} (${processingTime || 0}ms)`,
      );

      return savedBallot;
    } catch (error) {
      this.logger.error(`Failed to store encrypted ballot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Encrypts a plaintext vote and immediately stores it as a ballot.
   * This is a new, consolidated method to ensure processing time is always captured.
   */
  async encryptAndStoreVote(
    pollId: string,
    plaintextVote: number,
    voteIndex: number,
    contextData?: string,
  ): Promise<EncryptedBallot> {
    this.logger.log(
      `Beginning encryption and storage for vote ${plaintextVote} in poll ${pollId}`,
    );

    // Step 1: Encrypt the vote and get the ciphertext and processing time.
    // The encrypt method already calculates this for us.
    const { ciphertext, processingTime } = await this.encrypt(
      pollId,
      plaintextVote,
    );

    // Step 2: Store the new ballot, passing the processingTime directly.
    const storedBallot = await this.storeBallot(
      pollId,
      ciphertext,
      voteIndex,
      processingTime, // Pass the calculated time here
      contextData,
    );

    return storedBallot;
  }

  /**
   * Aggregate all encrypted ballots for a poll using homomorphic addition
   */
  async aggregate(
    pollId: string,
  ): Promise<{ aggregateCiphertext: string; ballotCount: number }> {
    try {
      // Verify poll exists and is anonymous
      const poll = await this.pollRepository.findOne({ where: { id: pollId } });
      if (!poll) {
        throw new BadRequestException('Poll not found');
      }

      if (!poll.anonymous) {
        throw new BadRequestException(
          'Homomorphic aggregation only available for anonymous polls',
        );
      }

      // Get all encrypted ballots for this poll
      const ballots = await this.encryptedBallotRepository.find({
        where: { pollId },
        order: { voteIndex: 'ASC' },
      });

      if (ballots.length === 0) {
        throw new BadRequestException(
          'No encrypted ballots found for this poll',
        );
      }

      this.logger.log(
        `Aggregating ${ballots.length} encrypted ballots for poll ${pollId}`,
      );

      // Load the first ciphertext as the starting point
      const aggregateCiphertext = this.seal.CipherText();
      aggregateCiphertext.load(this.context, ballots[0].ciphertext);

      // Add all subsequent ciphertexts homomorphically
      for (let i = 1; i < ballots.length; i++) {
        const currentCiphertext = this.seal.CipherText();
        currentCiphertext.load(this.context, ballots[i].ciphertext);

        // Perform homomorphic addition
        this.evaluator.add(
          aggregateCiphertext,
          currentCiphertext,
          aggregateCiphertext,
        );
      }

      // Serialize the aggregate ciphertext
      const aggregateString = aggregateCiphertext.save();

      // Track successful aggregation in metrics
      await this.securityService.incrementMetric(
        'homomorphic_aggregations_completed',
      );

      this.logger.log(
        `Successfully aggregated ${ballots.length} ballots for poll ${pollId}`,
      );

      return {
        aggregateCiphertext: aggregateString,
        ballotCount: ballots.length,
      };
    } catch (error) {
      this.logger.error(`Aggregation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Decrypt the aggregated result (for demonstration purposes)
   * In a real system, this would be done with threshold decryption
   */
  async decryptAggregate(
    aggregateCiphertext: string,
  ): Promise<{ result: number }> {
    try {
      // Load the aggregate ciphertext
      const ciphertext = this.seal.CipherText();
      ciphertext.load(this.context, aggregateCiphertext);

      // Decrypt the aggregate
      const plaintext = this.seal.PlainText();
      this.decryptor.decrypt(ciphertext, plaintext);

      // Decode the result (BatchEncoder returns an array)
      const resultArray = this.encoder.decode(plaintext);
      const result = resultArray[0]; // Get first element

      this.logger.log(`Decrypted aggregate result: ${result}`);

      return { result };
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Serialize encryption parameters for client use
   */
  private serializeEncryptionParams(): any {
    try {
      // Return a simple JSON representation instead of SEAL objects
      return {
        schemeType: 'BFV',
        polyModulusDegree: 4096,
        coeffModulusBitSizes: [50, 30, 30, 50], // Default BFV modulus chain
        plainModulusBitSize: 20,
        securityLevel: 'tc128',
      };
    } catch (error) {
      this.logger.error(
        `Failed to serialize encryption parameters: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Serialize public key for client use
   */
  private serializePublicKey(): string {
    try {
      return this.publicKey.save();
    } catch (error) {
      this.logger.error(`Failed to serialize public key: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check for SEAL initialization
   */
  isReady(): boolean {
    return !!(this.context && this.publicKey && this.encryptionParameters);
  }

  /**
   * Get encryption parameters for client-side encryption
   */
  async getEncryptionParams(pollId: string): Promise<{
    publicKey: string;
    encryptionParams: any;
    schemeType: string;
  }> {
    try {
      // Verify poll exists and is anonymous
      const poll = await this.pollRepository.findOne({ where: { id: pollId } });
      if (!poll) {
        throw new BadRequestException('Poll not found');
      }

      if (!poll.anonymous) {
        throw new BadRequestException(
          'Homomorphic encryption only available for anonymous polls',
        );
      }

      if (!this.isReady()) {
        throw new BadRequestException('SEAL library not properly initialized');
      }

      return {
        publicKey: this.serializePublicKey(),
        encryptionParams: this.serializeEncryptionParams(),
        schemeType: 'BFV',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get encryption parameters: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Clean up expired or processed ballots
   */
  async cleanupBallots(pollId: string): Promise<number> {
    try {
      const result = await this.encryptedBallotRepository
        .createQueryBuilder()
        .delete()
        .where('poll_id = :pollId', { pollId })
        .execute();

      const deletedCount = result.affected || 0;
      this.logger.log(
        `Cleaned up ${deletedCount} encrypted ballots for poll ${pollId}`,
      );

      return deletedCount;
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`);
      throw error;
    }
  }
}
