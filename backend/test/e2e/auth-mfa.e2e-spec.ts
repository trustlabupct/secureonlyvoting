import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';

const randomIp = () =>
  `10.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;

const withIp = (req: request.Test) => req.set('x-forwarded-for', randomIp());

describe('Auth & MFA (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const testUsername = 'mfa.e2e@example.com';
  const testPassword = 'MfaE2ePass123!';
  const testName = 'MFA E2E User';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    app.use(cookieParser());
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    await dataSource.query('TRUNCATE TABLE rate_limits RESTART IDENTITY');

    const passwordHash = await bcrypt.hash(testPassword, 12);
    await dataSource.query(
      `
      INSERT INTO users (username, email, password_hash, name, role, mfa_enabled, mfa_secret, mfa_recovery_codes)
      VALUES ($1, $2, $3, $4, 'user', false, NULL, NULL)
      ON CONFLICT (email)
      DO UPDATE SET
        username = EXCLUDED.username,
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role = 'user',
        mfa_enabled = false,
        mfa_secret = NULL,
        mfa_recovery_codes = NULL,
        updated_at = NOW()
      `,
      [testUsername, testUsername, passwordHash, testName],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  function login() {
    return withIp(
      request(app.getHttpServer()).post('/api/auth/login').send({
        username: testUsername,
        password: testPassword,
      }),
    );
  }

  it('supports standard no-MFA login and cookie-based auth profile access', async () => {
    const response = await login().expect(200);

    expect(response.body.requiresMFA).toBe(false);
    expect(response.body.access_token).toBeDefined();
    expect(response.body.refresh_token).toBeDefined();
    expect(response.body.user.username).toBe(testUsername);

    await withIp(
      request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Cookie', [`session=${response.body.access_token}`]),
    )
      .expect(200)
      .expect((res) => {
        expect(res.body.username).toBe(testUsername);
        expect(res.body.mfaEnabled).toBe(false);
      });
  });

  it('enables MFA and requires second factor on subsequent login', async () => {
    const loginResponse = await login().expect(200);
    const accessToken = loginResponse.body.access_token;

    const setupResponse = await withIp(
      request(app.getHttpServer())
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({}),
    ).expect(201);

    expect(setupResponse.body.setupKey).toBeDefined();
    expect(setupResponse.body.qrCodeUrl).toContain('data:image/');

    const setupToken = speakeasy.totp({
      secret: setupResponse.body.setupKey,
      encoding: 'base32',
    });

    const enableResponse = await withIp(
      request(app.getHttpServer())
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: setupToken }),
    ).expect(201);

    expect(Array.isArray(enableResponse.body.recoveryCodes)).toBe(true);
    expect(enableResponse.body.recoveryCodes.length).toBe(10);

    const mfaLoginResponse = await login().expect(200);
    expect(mfaLoginResponse.body.requiresMFA).toBe(true);
    expect(mfaLoginResponse.body.tempToken).toBeDefined();
    expect(mfaLoginResponse.body.access_token).toBeUndefined();

    await withIp(
      request(app.getHttpServer()).post('/api/auth/mfa/verify-login').send({
        tempToken: mfaLoginResponse.body.tempToken,
        token: '000000',
      }),
    ).expect(401);

    const validToken = speakeasy.totp({
      secret: setupResponse.body.setupKey,
      encoding: 'base32',
    });

    const verifiedLogin = await withIp(
      request(app.getHttpServer()).post('/api/auth/mfa/verify-login').send({
        tempToken: mfaLoginResponse.body.tempToken,
        token: validToken,
      }),
    ).expect(200);

    expect(verifiedLogin.body.access_token).toBeDefined();
    expect(verifiedLogin.body.refresh_token).toBeDefined();
    expect(verifiedLogin.body.user.username).toBe(testUsername);
  });

  it('supports recovery-code login and rejects reused recovery code', async () => {
    const loginResponse = await login().expect(200);
    expect(loginResponse.body.requiresMFA).toBe(true);

    const profileViaTempFlow = await withIp(
      request(app.getHttpServer())
        .post('/api/auth/mfa/recovery-login')
        .send({
          tempToken: loginResponse.body.tempToken,
          recoveryCode: 'INVALIDCODE',
        }),
    ).expect(401);
    expect(profileViaTempFlow.body.message).toBeDefined();

    const noMfaLogin = await withIp(
      request(app.getHttpServer()).post('/api/auth/login').send({
        username: testUsername,
        password: testPassword,
      }),
    ).expect(200);
    expect(noMfaLogin.body.requiresMFA).toBe(true);

    // Pull one recovery code by temporarily regenerating via verified MFA session.
    const setupResponse = await withIp(
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: testUsername, password: testPassword }),
    ).expect(200);
    expect(setupResponse.body.requiresMFA).toBe(true);

    const userRow = await dataSource.query(
      'SELECT mfa_secret FROM users WHERE email = $1',
      [testUsername],
    );
    const secret = userRow[0]?.mfa_secret as string | null;
    expect(secret).toBeTruthy();

    const verifiedLogin = await withIp(
      request(app.getHttpServer()).post('/api/auth/mfa/verify-login').send({
        tempToken: setupResponse.body.tempToken,
        token: speakeasy.totp({
          secret: secret ?? '',
          encoding: 'base32',
        }),
      }),
    ).expect(200);

    const regeneratedCodes = await withIp(
      request(app.getHttpServer())
        .post('/api/auth/mfa/recovery-codes')
        .set('Authorization', `Bearer ${verifiedLogin.body.access_token}`)
        .send({
          token: speakeasy.totp({
            secret: secret ?? '',
            encoding: 'base32',
          }),
        }),
    ).expect(201);

    const recoveryCode = regeneratedCodes.body.recoveryCodes[0];
    expect(recoveryCode).toBeDefined();

    const recoveryLogin = await withIp(
      request(app.getHttpServer()).post('/api/auth/mfa/recovery-login').send({
        tempToken: loginResponse.body.tempToken,
        recoveryCode,
      }),
    ).expect(200);

    expect(recoveryLogin.body.access_token).toBeDefined();
    expect(recoveryLogin.body.user.username).toBe(testUsername);

    const secondFactorAgain = await login().expect(200);
    expect(secondFactorAgain.body.requiresMFA).toBe(true);

    await withIp(
      request(app.getHttpServer()).post('/api/auth/mfa/recovery-login').send({
        tempToken: secondFactorAgain.body.tempToken,
        recoveryCode,
      }),
    ).expect(401);
  });

  it('disables MFA and returns account to no-MFA login flow', async () => {
    const firstStep = await login().expect(200);
    expect(firstStep.body.requiresMFA).toBe(true);

    const userRow = await dataSource.query(
      'SELECT mfa_secret FROM users WHERE email = $1',
      [testUsername],
    );
    const secret = userRow[0]?.mfa_secret as string | null;
    expect(secret).toBeTruthy();

    const secondStep = await withIp(
      request(app.getHttpServer()).post('/api/auth/mfa/verify-login').send({
        tempToken: firstStep.body.tempToken,
        token: speakeasy.totp({
          secret: secret ?? '',
          encoding: 'base32',
        }),
      }),
    ).expect(200);

    await withIp(
      request(app.getHttpServer())
        .delete('/api/auth/mfa')
        .set('Authorization', `Bearer ${secondStep.body.access_token}`)
        .send({
          token: speakeasy.totp({
            secret: secret ?? '',
            encoding: 'base32',
          }),
        }),
    ).expect(200);

    const finalLogin = await withIp(
      request(app.getHttpServer()).post('/api/auth/login').send({
        username: testUsername,
        password: testPassword,
      }),
    ).expect(200);

    expect(finalLogin.body.requiresMFA).toBe(false);
    expect(finalLogin.body.access_token).toBeDefined();
  });
});
