import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Feature flags (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('returns false for an unknown feature flag', async () => {
    const { projectId } = await createProjectWithEnvironments('development');

    await request(app.getHttpServer())
      .get(
        `/feature-flags/missing?projectId=${projectId}&environment=development`,
      )
      .expect(200)
      .expect({ enabled: false });
  });

  it('isolates a flag between environments in one project', async () => {
    const { client, projectId } = await createProjectWithEnvironments(
      'development',
      'staging',
    );
    const name = `environmental-checkout-${Date.now()}`;

    await client
      .post('/feature-flags')
      .send({ name, enabled: true, projectId, environment: 'staging' })
      .expect(201)
      .expect({
        name,
        projectId,
        environment: 'staging',
        enabled: true,
      });

    await request(app.getHttpServer())
      .get(
        `/feature-flags/${name}?projectId=${projectId}&environment=development`,
      )
      .expect(200)
      .expect({ enabled: false });
    await request(app.getHttpServer())
      .get(`/feature-flags/${name}?projectId=${projectId}&environment=staging`)
      .expect(200)
      .expect({ enabled: true });
  });

  it('supports flags in custom project environments', async () => {
    const client = await signIn();
    const project = await client
      .post('/projects')
      .send({ name: `Payments-${Date.now()}` })
      .expect(201);
    const projectId = project.body.id as string;

    await client
      .post(`/projects/${projectId}/environments`)
      .send({ name: 'qa' })
      .expect(201);

    const name = `qa-checkout-${Date.now()}`;
    await client
      .post('/feature-flags')
      .send({
        name,
        enabled: true,
        projectId,
        environment: 'qa',
      })
      .expect(201)
      .expect({
        name,
        projectId,
        environment: 'qa',
        enabled: true,
      });

    await request(app.getHttpServer())
      .get(`/feature-flags/${name}?projectId=${projectId}&environment=qa`)
      .expect(200)
      .expect({ enabled: true });
  });

  afterEach(async () => {
    await app.close();
  });
  async function createProjectWithEnvironments(...names: string[]) {
    const client = await signIn();
    const project = await client
      .post('/projects')
      .send({ name: `Project-${Date.now()}-${Math.random()}` })
      .expect(201);
    const projectId = project.body.id as string;

    for (const name of names) {
      await client
        .post(`/projects/${projectId}/environments`)
        .send({ name })
        .expect(201);
    }

    return { client, projectId };
  }

  async function signIn() {
    const client = request.agent(app.getHttpServer());
    await client
      .post('/api/auth/sign-in/username')
      .send({ username: 'flag3', password: 'flag3' })
      .expect(200);
    return client;
  }
});
