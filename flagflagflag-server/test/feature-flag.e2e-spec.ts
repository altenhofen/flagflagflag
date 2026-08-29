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
        percentage: 100,
        rules: [],
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

  it('evaluates targeting rules through the anonymous evaluation endpoint', async () => {
    const { client, projectId } =
      await createProjectWithEnvironments('development');
    const name = `targeted-checkout-${Date.now()}`;

    await client
      .post('/feature-flags')
      .send({
        name,
        enabled: true,
        projectId,
        environment: 'development',
        rules: [
          { attribute: 'plan', operator: 'equals', value: 'pro' },
          { attribute: 'age', operator: 'greaterThan', value: 18 },
        ],
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.rules).toEqual([
          { attribute: 'plan', operator: 'equals', value: 'pro' },
          { attribute: 'age', operator: 'greaterThan', value: 18 },
        ]);
      });

    await request(app.getHttpServer())
      .post(`/feature-flags/${name}/evaluate`)
      .send({
        projectId,
        environment: 'development',
        attributes: { plan: 'pro', age: 21 },
      })
      .expect(200)
      .expect({ enabled: true });
    await request(app.getHttpServer())
      .post(`/feature-flags/${name}/evaluate`)
      .send({
        projectId,
        environment: 'development',
        attributes: { plan: 'free', age: 21 },
      })
      .expect(200)
      .expect({ enabled: false });
  });
  it('stores and evaluates percentage rollouts', async () => {
    const { client, projectId } =
      await createProjectWithEnvironments('development');
    const name = `gradual-checkout-${Date.now()}`;

    await client
      .post('/feature-flags')
      .send({
        name,
        enabled: true,
        percentage: 0,
        projectId,
        environment: 'development',
      })
      .expect(201)
      .expect({
        name,
        projectId,
        environment: 'development',
        enabled: true,
        percentage: 0,
        rules: [],
      });

    await request(app.getHttpServer())
      .get(
        `/feature-flags/${name}?projectId=${projectId}&environment=development`,
      )
      .expect(200)
      .expect({ enabled: false });

    await client
      .patch(
        `/feature-flags/${name}?projectId=${projectId}&environment=development`,
      )
      .send({ enabled: true, percentage: 100 })
      .expect(200)
      .expect({
        name,
        projectId,
        environment: 'development',
        enabled: true,
        percentage: 100,
        rules: [],
      });

    await request(app.getHttpServer())
      .get(
        `/feature-flags/${name}?projectId=${projectId}&environment=development`,
      )
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

    const environment = await client
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
        percentage: 100,
        rules: [],
      });

    await request(app.getHttpServer())
      .get(`/feature-flags/${name}?projectId=${projectId}&environment=qa`)
      .expect(200)
      .expect({ enabled: true });

    await client.get('/projects').expect(200);
    await client
      .get(`/projects/${projectId}/environments`)
      .expect(200)
      .expect([{ id: environment.body.id, name: 'qa', projectId }]);
    await client
      .patch(`/projects/${projectId}/environments/${environment.body.id}`)
      .send({ name: 'quality-assurance' })
      .expect(200)
      .expect({
        id: environment.body.id,
        name: 'quality-assurance',
        projectId,
      });
    await client
      .patch(
        `/feature-flags/${name}?projectId=${projectId}&environment=quality-assurance`,
      )
      .send({ enabled: false })
      .expect(200)
      .expect({
        name,
        projectId,
        environment: 'quality-assurance',
        enabled: false,
        percentage: 100,
        rules: [],
      });
    await request(app.getHttpServer())
      .get(
        `/feature-flags/${name}?projectId=${projectId}&environment=quality-assurance`,
      )
      .expect(200)
      .expect({ enabled: false });
    await client
      .delete(
        `/feature-flags/${name}?projectId=${projectId}&environment=quality-assurance`,
      )
      .expect(204);
    await client
      .delete(`/projects/${projectId}/environments/${environment.body.id}`)
      .expect(204);
    await client.delete(`/projects/${projectId}`).expect(204);
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
