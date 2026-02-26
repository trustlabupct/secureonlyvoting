import { Test, TestingModule } from '@nestjs/testing';
import { SecurityService } from './security.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserSession } from './entities/user-session.entity';
import { RateLimit } from './entities/rate-limit.entity';
import { RateLimitPolicy } from './entities/rate-limit-policy.entity';
import { RevokedToken } from './entities/revoked-token.entity';
import { AppMetrics } from './entities/app-metrics.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

describe('SecurityService', () => {
  let service: SecurityService;
  let userSessionRepository: Repository<UserSession>;
  let jwtService: JwtService;

  const mockRepository = () => ({
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ raw: [{ attempts: 1 }] }),
    }),
  });

  const mockDataSource = {
    createQueryBuilder: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    }),
    query: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        {
          provide: getRepositoryToken(RateLimit),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(RateLimitPolicy),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(RevokedToken),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(UserSession),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(AppMetrics),
          useFactory: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
    userSessionRepository = module.get<Repository<UserSession>>(
      getRepositoryToken(UserSession),
    );
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('findValidSession performance optimization', () => {
    it('should use direct jti lookup for new sessions', async () => {
      const mockJti = 'test-jti-123';
      const mockRefreshToken = 'mock-refresh-token';
      const mockSession = {
        id: 'session-id',
        jti: mockJti,
        refreshTokenHash: await bcrypt.hash(mockRefreshToken, 10),
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      };

      // Mock JWT verification to return the jti
      (jwtService.verify as jest.Mock).mockReturnValue({
        tokenId: mockJti,
        type: 'refresh',
      });

      // Mock repository to return the session
      (userSessionRepository.findOne as jest.Mock).mockResolvedValue(
        mockSession,
      );

      const result = await service.findValidSession(mockRefreshToken);

      expect(result).toEqual(mockSession);

      // Verify that findOne was called with jti lookup (efficient method)
      expect(userSessionRepository.findOne).toHaveBeenCalledWith({
        where: {
          jti: mockJti,
          isActive: true,
          expiresAt: expect.any(Object), // MoreThan operator
        },
      });

      // Verify that find was NOT called (inefficient method)
      expect(userSessionRepository.find).not.toHaveBeenCalled();
    });

    it('should fall back to full scan for legacy sessions without jti', async () => {
      const mockRefreshToken = 'mock-refresh-token';
      const mockLegacySession = {
        id: 'legacy-session-id',
        jti: null,
        refreshTokenHash: await bcrypt.hash(mockRefreshToken, 10),
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      };

      // Mock JWT verification to fail (simulating legacy token)
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Mock repository methods
      (userSessionRepository.findOne as jest.Mock).mockResolvedValue(null);
      (userSessionRepository.find as jest.Mock).mockResolvedValue([
        mockLegacySession,
      ]);

      const result = await service.findValidSession(mockRefreshToken);

      expect(result).toEqual(mockLegacySession);

      // Verify that find was called for legacy sessions (fallback method)
      expect(userSessionRepository.find).toHaveBeenCalledWith({
        where: {
          isActive: true,
          expiresAt: expect.any(Object), // MoreThan operator
          jti: expect.any(Object), // IsNull operator
        },
      });
    });

    it('should handle invalid refresh token gracefully', async () => {
      const invalidToken = 'invalid-token';

      // Mock JWT verification to fail
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Mock repository to return no sessions
      (userSessionRepository.find as jest.Mock).mockResolvedValue([]);

      const result = await service.findValidSession(invalidToken);

      expect(result).toBeNull();
    });
  });

  describe('createSession with jti', () => {
    it('should store jti when provided', async () => {
      const userId = 'user-123';
      const refreshToken = 'refresh-token';
      const expiresAt = new Date();
      const jti = 'jti-123';

      const mockSession = {
        id: 'session-id',
        userId,
        jti,
        refreshTokenHash: 'hashed-token',
        expiresAt,
        isActive: true,
      };

      (userSessionRepository.save as jest.Mock).mockResolvedValue(mockSession);

      const result = await service.createSession(
        userId,
        refreshToken,
        expiresAt,
        undefined,
        undefined,
        jti,
      );

      expect(userSessionRepository.save).toHaveBeenCalledWith({
        userId,
        refreshTokenHash: expect.any(String),
        jti,
        expiresAt,
        ipAddress: null,
        userAgent: null,
      });

      expect(result).toEqual(mockSession);
    });
  });
});
