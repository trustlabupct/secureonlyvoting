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

describe('Visibility & Permissions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let adminToken: string;
  let userToken: string;

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
      `SELECT id, username, role FROM users WHERE username IN ('hr@example.com', 'elections@example.com')`,
    );

    const admin = users.find((u) => u.username === 'hr@example.com');
    const voter = users.find((u) => u.username === 'elections@example.com');

    if (!admin || !voter) {
      throw new Error(
        'Required test users missing. Expected hr@example.com and elections@example.com',
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication even for everyone-visible poll details', async () => {
    const created = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Everyone Poll',
          description: 'Auth behavior test',
          startTime: new Date(Date.now() - 60_000).toISOString(),
          endTime: new Date(Date.now() + 600_000).toISOString(),
          votingMechanism: 'yes-no',
          visibility: 'everyone',
          anonymous: false,
          options: [],
        }),
    ).expect(201);

    await withIp(
      request(app.getHttpServer()).get(`/api/polls/${created.body.id}`),
    ).expect(401);

    await withIp(
      request(app.getHttpServer())
        .get(`/api/polls/${created.body.id}`)
        .set('Authorization', `Bearer ${userToken}`),
    ).expect(200);
  });

  it('allows results only after voting for non-admin voters', async () => {
    const created = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Voter Result Gate Poll',
          description: 'Result gate test',
          startTime: new Date(Date.now() - 60_000).toISOString(),
          endTime: new Date(Date.now() + 600_000).toISOString(),
          votingMechanism: 'multiple-choice',
          visibility: 'everyone',
          anonymous: false,
          options: [{ name: 'A' }, { name: 'B' }],
        }),
    ).expect(201);

    await withIp(
      request(app.getHttpServer())
        .get(`/api/polls/${created.body.id}/results`)
        .set('Authorization', `Bearer ${userToken}`),
    ).expect(403);

    await withIp(
      request(app.getHttpServer())
        .post('/api/votes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ pollId: created.body.id, optionId: created.body.options[0].id }),
    ).expect(201);

    await withIp(
      request(app.getHttpServer())
        .get(`/api/polls/${created.body.id}/results`)
        .set('Authorization', `Bearer ${userToken}`),
    ).expect(200);
  });

  it('enforces admin-only visibility', async () => {
    const created = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Only Poll',
          description: 'Admin visibility test',
          startTime: new Date(Date.now() - 60_000).toISOString(),
          endTime: new Date(Date.now() + 600_000).toISOString(),
          votingMechanism: 'yes-no',
          visibility: 'admin-only',
          anonymous: false,
          options: [],
        }),
    ).expect(201);

    await withIp(
      request(app.getHttpServer())
        .get(`/api/polls/${created.body.id}`)
        .set('Authorization', `Bearer ${userToken}`),
    ).expect(403);

    await withIp(
      request(app.getHttpServer())
        .get(`/api/polls/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`),
    ).expect(200);
  });

  it('enforces specific-groups visibility for users without group claims', async () => {
    const created = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Specific Group Poll',
          description: 'Group visibility test',
          startTime: new Date(Date.now() - 60_000).toISOString(),
          endTime: new Date(Date.now() + 600_000).toISOString(),
          votingMechanism: 'multiple-choice',
          visibility: 'specific-groups',
          anonymous: false,
          allowedGroups: ['elections', 'board'],
          options: [{ name: 'A' }, { name: 'B' }],
        }),
    ).expect(201);

    await withIp(
      request(app.getHttpServer())
        .get(`/api/polls/${created.body.id}`)
        .set('Authorization', `Bearer ${userToken}`),
    ).expect(403);

    await withIp(
      request(app.getHttpServer())
        .get(`/api/polls/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`),
    ).expect(200);
  });

  it('restricts tally encryption endpoint to admin role', async () => {
    const anonymousPoll = await withIp(
      request(app.getHttpServer())
        .post('/api/admin/polls')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Anonymous HE Poll',
          description: 'Tally guard test',
          startTime: new Date(Date.now() - 60_000).toISOString(),
          endTime: new Date(Date.now() + 600_000).toISOString(),
          votingMechanism: 'yes-no',
          visibility: 'everyone',
          anonymous: true,
          options: [],
        }),
    ).expect(201);

    await withIp(
      request(app.getHttpServer())
        .post('/api/tally/encrypt')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          pollId: anonymousPoll.body.id,
          plaintextVote: 1,
        }),
    ).expect(403);

    await withIp(
      request(app.getHttpServer())
        .post('/api/tally/encrypt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pollId: anonymousPoll.body.id,
          plaintextVote: 1,
        }),
    ).expect(200);
  });
});
