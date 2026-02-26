import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users/entities/user.entity'; // Corrected relative path
import {
  CreateUserDto,
  UpdateUserDto,
  PartialUpdateUserDto,
} from './users/entities/user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Finds a single user by their username.
   * Used primarily for authentication.
   * @param username The username to search for.
   * @returns The user entity or undefined if not found.
   */
  async findOneByUsername(username: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({ where: { username } });
    return user ?? undefined; // Explicitly return undefined if user is null
  }

  /**
   * Finds a user by their ID.
   * @param id The UUID of the user to find.
   * @returns The user entity.
   * @throws NotFoundException if the user is not found.
   */
  async findOneById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return user;
  }

  /**
   * Finds a user by their certificate ID.
   * Used for certificate authentication.
   * @param certificateId The certificate ID to search for.
   * @returns The user entity or null if not found.
   */
  async findByCertificateId(certificateId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: {
        certificateId,
        certificateEnabled: true, // Only find users with certificate auth enabled
      },
    });
    return user ?? null;
  }

  /**
   * Updates a user's certificate information.
   * @param userId The user ID.
   * @param certificateId The certificate ID.
   * @param certificateFingerprint The certificate fingerprint.
   * @returns The updated user entity.
   */
  async updateCertificate(
    userId: string,
    certificateId: string,
    certificateFingerprint: string,
  ): Promise<User> {
    const user = await this.findOneById(userId);
    user.certificateId = certificateId;
    user.certificateFingerprint = certificateFingerprint;
    user.certificateEnabled = true;
    return this.userRepository.save(user);
  }

  /**
   * Disables certificate authentication for a user.
   * @param userId The user ID.
   * @returns The updated user entity.
   */
  async disableCertificate(userId: string): Promise<User> {
    const user = await this.findOneById(userId);
    user.certificateEnabled = false;
    return this.userRepository.save(user);
  }

  /**
   * Updates a user with partial data (internal method for service use).
   * @param id The UUID of the user to update.
   * @param updateData The data to update.
   * @returns The updated user entity.
   * @throws NotFoundException if the user is not found.
   */
  async updateUser(
    id: string,
    updateData: PartialUpdateUserDto,
  ): Promise<User> {
    this.logger.debug(
      `updateUser called for user ${id} with data:`,
      this.sanitizeUpdateDataForLogs(updateData),
    );

    const user = await this.findOneById(id);
    this.logger.debug(
      `Found user before update:`,
      this.sanitizeUserForLogs(user),
    );

    // Update fields if provided
    if (updateData.name !== undefined) {
      user.name = updateData.name;
    }

    // Handle password update if provided
    if (updateData.password) {
      const salt = await bcrypt.genSalt();
      user.passwordHash = await bcrypt.hash(updateData.password, salt);
    }

    // Update role if provided
    if (updateData.role !== undefined) {
      user.role = updateData.role;
    }

    // Update MFA fields if provided
    if (updateData.mfaEnabled !== undefined) {
      this.logger.debug(`Updating mfaEnabled to: ${updateData.mfaEnabled}`);
      user.mfaEnabled = updateData.mfaEnabled;
    }

    if (updateData.mfaSecret !== undefined) {
      this.logger.debug(`Updating mfaSecret value`);
      user.mfaSecret = updateData.mfaSecret;
    }

    if (updateData.mfaRecoveryCodes !== undefined) {
      this.logger.debug(
        `Updating mfaRecoveryCodes with ${updateData.mfaRecoveryCodes?.length} codes`,
      );
      user.mfaRecoveryCodes = updateData.mfaRecoveryCodes;
    }

    this.logger.debug(`User data before save:`, this.sanitizeUserForLogs(user));

    // Save and return the updated user
    const savedUser = await this.userRepository.save(user);

    this.logger.debug(
      `User data after save:`,
      this.sanitizeUserForLogs(savedUser),
    );

    return savedUser;
  }

  private sanitizeUpdateDataForLogs(updateData: PartialUpdateUserDto) {
    return {
      ...updateData,
      password:
        updateData.password !== undefined ? '[REDACTED_PASSWORD]' : undefined,
      mfaSecret:
        updateData.mfaSecret !== undefined ? '[REDACTED_MFA_SECRET]' : undefined,
      mfaRecoveryCodes:
        updateData.mfaRecoveryCodes !== undefined
          ? `[REDACTED_CODES:${updateData.mfaRecoveryCodes?.length ?? 0}]`
          : undefined,
    };
  }

  private sanitizeUserForLogs(user: User) {
    return {
      id: user.id,
      username: user.username,
      mfaEnabled: user.mfaEnabled,
      hasMfaSecret: !!user.mfaSecret,
      mfaRecoveryCodesCount: user.mfaRecoveryCodes?.length ?? 0,
    };
  }

  /**
   * Creates a new user.
   * @param createUserDto The data for creating a new user.
   * @returns The newly created user entity.
   * @throws ConflictException if the username is already taken.
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if username is already taken
    const existingUser = await this.userRepository.findOne({
      where: { username: createUserDto.username },
    });

    if (existingUser) {
      throw new ConflictException(
        `Username "${createUserDto.username}" is already taken`,
      );
    }

    // Hash the password
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    // Create and save the new user
    const user = this.userRepository.create({
      username: createUserDto.username,
      passwordHash,
      name: createUserDto.name,
      // Set default role if not provided
      role: createUserDto.role || 'user',
    });

    return this.userRepository.save(user);
  }

  /**
   * Updates a user.
   * @param id The UUID of the user to update.
   * @param updateUserDto The data to update.
   * @returns The updated user entity.
   * @throws NotFoundException if the user is not found.
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Find the user first
    const user = await this.findOneById(id);

    // Update fields if provided
    if (updateUserDto.name !== undefined) {
      user.name = updateUserDto.name;
    }

    // Handle password update if provided
    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt();
      user.passwordHash = await bcrypt.hash(updateUserDto.password, salt);
    }

    // Update role if provided
    if (updateUserDto.role) {
      user.role = updateUserDto.role;
    }

    // Save and return the updated user
    return this.userRepository.save(user);
  }

  /**
   * Removes a user.
   * @param id The UUID of the user to remove.
   * @throws NotFoundException if the user is not found.
   */
  async remove(id: string): Promise<void> {
    const user = await this.findOneById(id);
    await this.userRepository.remove(user);
  }

  /**
   * Finds all users.
   * @returns Array of user entities.
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  /**
   * Updates a user's password hash.
   * @param id The UUID of the user to update.
   * @param passwordHash The new password hash.
   * @returns The updated user entity.
   * @throws NotFoundException if the user is not found.
   */
  async updatePassword(id: string, passwordHash: string): Promise<User> {
    const user = await this.findOneById(id);
    user.passwordHash = passwordHash;
    return this.userRepository.save(user);
  }
}
