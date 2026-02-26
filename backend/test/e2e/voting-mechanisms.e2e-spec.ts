import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../src/users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';

const randomIp = () =>
  `10.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;

const withIp = (req: request.Test) => req.set('x-forwarded-for', randomIp());

describe('Voting Mechanisms (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let adminToken: string;
  let userToken: string;
  let boardToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await dataSource.query(
      'TRUNCATE TABLE encrypted_ballots, votes, blind_tokens, options, polls RESTART IDENTITY CASCADE',
    );
    await dataSource.query('TRUNCATE TABLE rate_limits RESTART IDENTITY');

    const users: User[] = await dataSource.query(
      `SELECT id, username, role FROM users WHERE username IN ('hr@example.com', 'elections@example.com', 'board@example.com')`,
    );

    const admin = users.find((u) => u.username === 'hr@example.com');
    const voter = users.find((u) => u.username === 'elections@example.com');
    const board = users.find((u) => u.username === 'board@example.com');

    if (!admin || !voter || !board) {
      throw new Error(
        'Required test users missing. Expected hr@example.com, elections@example.com, board@example.com',
      );
    }

    adminToken = jwtService.sign({
      sub: admin.id,
      username: admin.username,
      role: admin.role,
    });
    userToken = jwtService.sign({
      sub: voter.id,
      username: voter.username,
      role: voter.role,
    });
    boardToken = jwtService.sign({
      sub: board.id,
      username: board.username,
      role: board.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('supports yes-no poll voting and result retrieval', async () => {
    const pollData = {
      name: 'E2E Yes/No Poll',
      description: 'Mechanism smoke test',
      startTime: new Date(Date.now() - 60_000).toISOString(),
      endTime: new Date(Date.now() + 600_000).toISOString(),
      votingMechanism: 'yes-no',
      visibility: 'everyone',
      anonymous: false,
      options: [],
    };

    const created = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(pollData),
    ).expect(201);

    expect(created.body.options).toHaveLength(2);

    const pollId = created.body.id;
    const pollDetails = await withIp(
      request(app.getHttpServer())
        .get(`/api/polls/${pollId}`)
        .set('Authorization', `Bearer ${userToken}`),
    ).expect(200);

    const yesOption = pollDetails.body.options.find((o) => o.name === 'Yes');
    expect(yesOption).toBeDefined();

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ pollId, optionId: yesOption.id }),
    ).expect(201);

    const results = await withIp(
      request(app.getHttpServer())
        .get(`/api/polls/${pollId}/results`)
        .set('Authorization', `Bearer ${userToken}`),
    ).expect(200);

    expect(Array.isArray(results.body)).toBe(true);
    const yesResult = results.body.find((r) => r.optionName === 'Yes');
    expect(yesResult.count).toBe(1);
  });

  it('blocks duplicate vote submissions for a user', async () => {
    const pollData = {
      name: 'E2E Duplicate Vote Poll',
      description: 'Duplicate guard test',
      startTime: new Date(Date.now() - 60_000).toISOString(),
      endTime: new Date(Date.now() + 600_000).toISOString(),
      votingMechanism: 'multiple-choice',
      visibility: 'everyone',
      anonymous: false,
      options: [{ name: 'A' }, { name: 'B' }],
    };

    const created = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(pollData),
    ).expect(201);

    const pollId = created.body.id;
    const optionId = created.body.options[0].id;

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ pollId, optionId }),
    ).expect(201);

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ pollId, optionId: created.body.options[1].id }),
    ).expect(403);
  });

  it('supports multiple-selection voting payload', async () => {
    const pollData = {
      name: 'E2E Multi Select Poll',
      description: 'Multi select test',
      startTime: new Date(Date.now() - 60_000).toISOString(),
      endTime: new Date(Date.now() + 600_000).toISOString(),
      votingMechanism: 'multiple-selection',
      visibility: 'everyone',
      anonymous: false,
      options: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    };

    const created = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(pollData),
    ).expect(201);

    const pollId = created.body.id;
    const selectedOptionIds = [created.body.options[0].id, created.body.options[2].id];

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${boardToken}`)
        .send({ pollId, selectedOptionIds }),
    ).expect(201);

    const results = await withIp(
      request(app.getHttpServer())
        .get(`/api/polls/${pollId}/results`)
        .set('Authorization', `Bearer ${boardToken}`),
    ).expect(200);

    const optionA = results.body.find((r) => r.optionName === 'A');
    const optionC = results.body.find((r) => r.optionName === 'C');
    expect(optionA.count).toBe(1);
    expect(optionC.count).toBe(1);
  });

  it('enforces complete ranking and option ownership validation', async () => {
    const pollData = {
      name: 'E2E Ranking Poll',
      description: 'Ranking test',
      startTime: new Date(Date.now() - 60_000).toISOString(),
      endTime: new Date(Date.now() + 600_000).toISOString(),
      votingMechanism: 'ranking',
      visibility: 'everyone',
      anonymous: false,
      options: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    };

    const created = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(pollData),
    ).expect(201);

    const pollId = created.body.id;
    const options = created.body.options;

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          pollId,
          rankedOptionIds: [options[0].id, options[1].id],
        }),
    ).expect(400);

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          pollId,
          rankedOptionIds: [options[2].id, options[1].id, options[0].id],
        }),
    ).expect(201);
  });

  it('validates rating scale and text-response comment policy', async () => {
    const ratingPoll = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Rating Poll',
          description: 'Rating validation test',
          startTime: new Date(Date.now() - 60_000).toISOString(),
          endTime: new Date(Date.now() + 600_000).toISOString(),
          votingMechanism: 'rating',
          visibility: 'everyone',
          anonymous: false,
          ratingScale: {
            min: 1,
            max: 5,
            step: 2,
            labels: {
              min: 'Low',
              max: 'High',
            },
          },
          options: [{ name: 'Service' }],
        }),
    ).expect(201);

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${boardToken}`)
        .send({ pollId: ratingPoll.body.id, ratingValue: 4 }),
    ).expect(400);

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${boardToken}`)
        .send({ pollId: ratingPoll.body.id, ratingValue: 3 }),
    ).expect(201);

    const textPoll = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Text Poll',
          description: 'Text response validation test',
          startTime: new Date(Date.now() - 60_000).toISOString(),
          endTime: new Date(Date.now() + 600_000).toISOString(),
          votingMechanism: 'text-response',
          visibility: 'everyone',
          anonymous: false,
          allowComments: false,
          options: [],
        }),
    ).expect(201);

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          pollId: textPoll.body.id,
          textResponse: 'This is the answer',
          comment: 'Should be rejected',
        }),
    ).expect(400);

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          pollId: textPoll.body.id,
          textResponse: 'This is the accepted answer',
        }),
    ).expect(201);
  });
});
