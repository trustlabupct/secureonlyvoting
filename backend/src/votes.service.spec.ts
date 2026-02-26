import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VotesService } from './votes/votes.service';
import { Vote } from './votes/entities/vote.entity';
import { Poll } from './polls/entities/poll.entity';
import { PollsService } from './polls/polls.service';
import { BlindTokensService } from './blind-tokens/blind-tokens.service';
import { UserContext } from './auth/auth.interfaces';

type MockRepository<T extends object = object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends object = object>(): MockRepository<T> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const createMockPollsService = (): Partial<Record<keyof PollsService, jest.Mock>> => ({
  findOne: jest.fn(),
});

const createMockBlindTokenService = (): Partial<
  Record<keyof BlindTokensService, jest.Mock>
> => ({
  validateAndUseBlindToken: jest.fn(),
});

describe('VotesService', () => {
  let service: VotesService;
  let pollRepository: MockRepository<Poll>;
  let voteRepository: MockRepository<Vote>;
  let pollsService: Partial<Record<keyof PollsService, jest.Mock>>;

  const mockUser: UserContext = {
    id: 'f6cbf6f4-58df-4c73-8c47-2cb37a36390a',
    username: 'test-user',
    role: 'user' as any,
    roles: ['user' as any],
  };

  const buildPoll = (overrides: Partial<Poll> = {}): Poll =>
    ({
      id: 'a1059d41-17d8-4a4f-a89e-bb51f72657c4',
      name: 'Test Poll',
      anonymous: false,
      allowComments: false,
      votingMechanism: 'multiple-choice',
      options: [
        { id: '11111111-1111-1111-1111-111111111111' },
        { id: '22222222-2222-2222-2222-222222222222' },
      ] as any,
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(Date.now() + 60000),
      ...overrides,
    }) as Poll;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VotesService,
        { provide: getRepositoryToken(Vote), useValue: createMockRepository<Vote>() },
        { provide: getRepositoryToken(Poll), useValue: createMockRepository<Poll>() },
        { provide: PollsService, useValue: createMockPollsService() },
        { provide: BlindTokensService, useValue: createMockBlindTokenService() },
      ],
    }).compile();

    service = module.get<VotesService>(VotesService);
    pollRepository = module.get(getRepositoryToken(Poll));
    voteRepository = module.get(getRepositoryToken(Vote));
    pollsService = module.get(PollsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create should throw when poll does not exist', async () => {
    pollRepository.findOne!.mockResolvedValue(null);

    await expect(
      service.create('missing-poll-id', { optionId: '11111111-1111-1111-1111-111111111111' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('create should reject optionId that does not belong to the poll', async () => {
    pollRepository.findOne!.mockResolvedValue(buildPoll());

    await expect(
      service.create(
        'a1059d41-17d8-4a4f-a89e-bb51f72657c4',
        { optionId: '33333333-3333-3333-3333-333333333333' },
        mockUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('create should reject payload with extra mechanism fields', async () => {
    pollRepository.findOne!.mockResolvedValue(
      buildPoll({ votingMechanism: 'multiple-choice' }),
    );

    await expect(
      service.create(
        'a1059d41-17d8-4a4f-a89e-bb51f72657c4',
        {
          optionId: '11111111-1111-1111-1111-111111111111',
          ratingValue: 3,
        },
        mockUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('create should reject ranking votes that do not rank all options', async () => {
    pollRepository.findOne!.mockResolvedValue(
      buildPoll({ votingMechanism: 'ranking' }),
    );

    await expect(
      service.create(
        'a1059d41-17d8-4a4f-a89e-bb51f72657c4',
        {
          rankedOptionIds: ['11111111-1111-1111-1111-111111111111'],
        },
        mockUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('create should reject comments when poll comments are disabled', async () => {
    pollRepository.findOne!.mockResolvedValue(buildPoll({ allowComments: false }));

    await expect(
      service.create(
        'a1059d41-17d8-4a4f-a89e-bb51f72657c4',
        {
          optionId: '11111111-1111-1111-1111-111111111111',
          comment: 'This should be rejected',
        },
        mockUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('create should save a valid authenticated multiple-choice vote', async () => {
    const poll = buildPoll({ votingMechanism: 'multiple-choice' });
    pollRepository.findOne!.mockResolvedValue(poll);
    pollsService.findOne!.mockResolvedValue({
      ...poll,
      canVote: true,
      hasVoted: false,
    });
    voteRepository.findOne!.mockResolvedValue(null);

    const createdVote = {
      pollId: poll.id,
      userId: mockUser.id,
      optionId: '11111111-1111-1111-1111-111111111111',
    } as Vote;

    const savedVote = {
      ...createdVote,
      id: 'f0d9f8e4-b84f-4f52-8b8c-c85d178807e6',
      createdAt: new Date(),
    } as Vote;

    voteRepository.create!.mockReturnValue(createdVote);
    voteRepository.save!.mockResolvedValue(savedVote);

    await expect(
      service.create(
        poll.id,
        { optionId: '11111111-1111-1111-1111-111111111111' },
        mockUser,
      ),
    ).resolves.toEqual(savedVote);
  });

  it('create should block authenticated users from voting twice', async () => {
    const poll = buildPoll({ votingMechanism: 'multiple-choice' });
    pollRepository.findOne!.mockResolvedValue(poll);
    pollsService.findOne!.mockResolvedValue({
      ...poll,
      canVote: true,
      hasVoted: false,
    });
    voteRepository.findOne!.mockResolvedValue({ id: 'existing-vote' } as Vote);

    await expect(
      service.create(
        poll.id,
        { optionId: '11111111-1111-1111-1111-111111111111' },
        mockUser,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
