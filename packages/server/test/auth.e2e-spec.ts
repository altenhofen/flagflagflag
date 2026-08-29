import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('supports default login, user creation, and password changes', async () => {
    const client = request.agent(app.getHttpServer());
    const username = `user${Date.now().toString().slice(-6)}`;
    const email = `${username}@localhost.test`;
    await client
      .post('/api/auth/sign-in/username')
      .send({ username: 'flag3', password: 'flag3' })
      .expect((response) => {
        if (
          response.status !== 200 ||
          typeof response.body.token !== 'string' ||
          typeof response.body.expiresAt !== 'string' ||
          Object.keys(response.body).length !== 2
        ) {
          throw new Error(JSON.stringify(response.body));
        }
      });

    const newUser = request.agent(app.getHttpServer());
    await newUser
      .post('/api/auth/sign-up/email')
      .send({ username, email, name: username, password: 'secret' })
      .expect(200);

    await newUser
      .post('/api/auth/change-password')
      .send({ currentPassword: 'secret', newPassword: 'changed' })
      .expect(200);

    await newUser
      .post('/api/auth/sign-in/username')
      .send({ username, password: 'changed' })
      .expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});
