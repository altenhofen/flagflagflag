import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

const API_PREFIX = '/api/v1';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('supports login, registration, password changes, logout, and current-user lookup', async () => {
    const login = await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/login`)
      .send({ username: 'flag3', password: 'flag3' })
      .expect(200);
    assertSafeToken(login.body);

    const username = `user-${Date.now().toString(36)}`;
    const email = `${username}@localhost.test`;
    const registration = await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/register`)
      .send({ username, email, name: 'E2E User', password: 'secret' })
      .expect(200);
    assertSafeToken(registration.body);
    expect(registration.body.user).toMatchObject({ username, email, name: 'E2E User' });

    const token = registration.body.accessToken as string;
    const authorization = { Authorization: `Bearer ${token}` };

    await request(app.getHttpServer())
      .get(`${API_PREFIX}/auth/me`)
      .set(authorization)
      .expect(200)
      .expect({
        id: registration.body.user.id,
        username,
        email,
        name: 'E2E User',
      });

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/password`)
      .set(authorization)
      .send({ currentPassword: 'secret', newPassword: 'changed' })
      .expect(200)
      .expect({ status: true });

    const changedLogin = await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/login`)
      .send({ username, password: 'changed' })
      .expect(200);
    assertSafeToken(changedLogin.body);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/logout`)
      .set(authorization)
      .expect(200)
      .expect({ status: true });
  });

  afterEach(async () => {
    await app.close();
  });

  function assertSafeToken(body: unknown): asserts body is {
    accessToken: string;
    tokenType: 'Bearer';
    expiresAt: string;
    user: { id: string; username: string; email: string; name: string };
  } {
    expect(body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresAt: expect.any(String),
      user: {
        id: expect.any(String),
        username: expect.any(String),
        email: expect.any(String),
        name: expect.any(String),
      },
    });
    expect(JSON.stringify(body)).not.toContain('passwordHash');
    expect(JSON.stringify(body)).not.toContain('password');
  }
});
