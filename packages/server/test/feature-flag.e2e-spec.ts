import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('Feature flags (e2e)', () => {
  let app: INestApplication;
  let authorization: { Authorization: string };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'flag3', password: 'flag3' })
      .expect(200);
    authorization = { Authorization: `Bearer ${login.body.accessToken}` };
  });

  it('creates nested resources and evaluates a stable flag', async () => {
    const project = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(authorization)
      .send({ name: `Project-${Date.now()}` })
      .expect(201);
    const projectId = project.body.id as string;
    const environment = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/environments`)
      .set(authorization)
      .send({ name: 'production' })
      .expect(201);
    const environmentId = environment.body.id as string;
    const base = `/api/v1/projects/${projectId}/environments/${environmentId}/flags`;
    await request(app.getHttpServer())
      .post(base)
      .set(authorization)
      .send({
        key: 'new-checkout', name: 'New checkout', enabled: true, defaultValue: false,
        rollout: null,
        rules: [{ id: 'pro-users', priority: 1, result: true, conditions: [{ attribute: 'plan', operator: 'equals', value: 'pro' }] }],
      })
      .expect(201);
    await request(app.getHttpServer()).get(base).set(authorization).expect(200).expect((response) => {
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].key).toBe('new-checkout');
    });
    await request(app.getHttpServer())
      .post('/api/v1/evaluate')
      .send({ projectId, environmentId, flagKey: 'new-checkout', context: { plan: 'pro' }, fallback: false })
      .expect(200)
      .expect({ flagKey: 'new-checkout', value: true, reason: 'RULE_MATCH', matchedRuleId: 'pro-users', configVersion: 0 });
    await request(app.getHttpServer())
      .post('/api/v1/evaluate/batch')
      .send({ projectId, environmentId, context: { plan: 'free' }, flags: ['new-checkout', 'missing'] })
      .expect(200)
      .expect((response) => {
        expect(response.body.results).toHaveLength(2);
        expect(response.body.results[0].value).toBe(false);
        expect(response.body.results[1].reason).toBe('FLAG_NOT_FOUND');
      });
  });

  afterEach(async () => { await app.close(); });
});
