import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SecurityService } from './security/security.service';
import * as speakeasy from 'speakeasy';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<Record<keyof UsersService, jest.Mock>>;
  let jwtService: Partial<Record<keyof JwtService, jest.Mock>>;
  let configService: Partial<Record<keyof ConfigService, jest.Mock>>;
  let securityService: Partial<Record<keyof SecurityService, jest.Mock>>;

  beforeEach(async () => {
    // Mock dependencies
    usersService = {
      findOneByUsername: jest.fn(),
      create: jest.fn(),
    };
    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };
    securityService = {
      createSession: jest.fn(),
      revokeToken: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllUserSessions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: SecurityService,
          useValue: securityService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('custom TOTP verification should evaluate shifted time windows', () => {
    const baseTimeSeconds = 1_700_000_000;
    const matchingOffset = 1;
    const matchingTime = (Math.floor(baseTimeSeconds / 30) + matchingOffset) * 30;

    jest.spyOn(Date, 'now').mockReturnValue(baseTimeSeconds * 1000);
    const totpSpy = jest
      .spyOn(speakeasy, 'totp')
      .mockImplementation(({ time }: { time?: number }) => {
        return time === matchingTime ? '654321' : '000000';
      });

    const verified = (service as any).customTOTPVerify('654321', 'BASE32SECRET');

    expect(verified).toBe(true);
    expect(totpSpy).toHaveBeenCalledTimes(4);
    expect(totpSpy).toHaveBeenCalledWith(
      expect.objectContaining({ time: matchingTime, step: 30 }),
    );
  });
});
