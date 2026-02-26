import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { PollsService } from './polls/polls.service';
import { Poll } from './polls/entities/poll.entity';
import { Option } from './polls/entities/option.entity';
import { Vote } from './votes/entities/vote.entity';

type MockRepository<T extends object = object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends object = object>(): MockRepository<T> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  existsBy: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
});

const createMockDataSource = () => ({
  createQueryRunner: jest.fn().mockReturnValue({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      save: jest.fn(),
      delete: jest.fn(),
    },
  }),
});

describe('PollsService', () => {
  let service: PollsService;
  let pollRepository: MockRepository<Poll>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService,
        { provide: getRepositoryToken(Poll), useValue: createMockRepository<Poll>() },
        { provide: getRepositoryToken(Vote), useValue: createMockRepository<Vote>() },
        { provide: getRepositoryToken(Option), useValue: createMockRepository<Option>() },
        { provide: DataSource, useValue: createMockDataSource() },
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
    pollRepository = module.get(getRepositoryToken(Poll));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findOne should throw when poll is missing', async () => {
    pollRepository.findOne!.mockResolvedValue(null);

    await expect(service.findOne('missing-poll-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getVoteCount should throw when poll does not exist', async () => {
    pollRepository.existsBy!.mockResolvedValue(false);
    await expect(service.getVoteCount('missing-poll-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
