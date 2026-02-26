import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';
import { Repository } from 'typeorm';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Partial<Record<keyof Repository<User>, jest.Mock>>;

  beforeEach(async () => {
    // Mock UserRepository
    userRepository = {
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository, // Provide the mock
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more specific tests here later...
});
