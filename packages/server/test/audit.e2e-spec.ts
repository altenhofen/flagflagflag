import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';

const API_PREFIX = '/api/v1';

type Authorization = { Authorization: string };

type ProjectEnvironment = {
  projectId: string;
  environmentId: string;
};

describe('Audit API (e2e)', () => {
  let app: INestApplication;
  let authorization: Authorization;
  let auditDatabase: { isInitialized: boolean; destroy(): Promise<void> } | undefined;
  let databaseDirectory: string | undefined;
  let previousDatabasePath: string | undefined;

  beforeEach(async () => {
    previousDatabasePath = process.env.SQLITE_DATABASE;
    databaseDirectory = mkdtempSync(join(tmpdir(), 'flagflagflag-audit-e2e-'));
    process.env.SQLITE_DATABASE = join(databaseDirectory, 'audit.sqlite');
    vi.resetModules();
    const [{ AppModule }, { featureFlagDataSource }] = await Promise.all([
      import('./../src/app.module.js'),
      import('./../src/database.js'),
    ]);
    auditDatabase = featureFlagDataSource;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    const login = await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/login`)
      .send({ username: 'flag3', password: 'flag3' })
      .expect(200);
    authorization = { Authorization: `Bearer ${login.body.accessToken}` };
  });
  afterEach(async () => {
    if (app) await app.close();
    if (auditDatabase?.isInitialized) await auditDatabase.destroy();
    if (databaseDirectory) rmSync(databaseDirectory, { recursive: true, force: true });
    if (previousDatabasePath === undefined) delete process.env.SQLITE_DATABASE;
    else process.env.SQLITE_DATABASE = previousDatabasePath;
    auditDatabase = undefined;
    databaseDirectory = undefined;
  });

  it('scopes logs to a project and applies environment, resource, and action filters together', async () => {
    const first = await createProjectEnvironment('scoped');
    const secondEnvironment = await createEnvironment(first.projectId, 'staging');
    const otherProject = await createProjectEnvironment('other-project');

    const firstFlag = await createFlag(first, 'scoped-flag');
    await request(app.getHttpServer())
      .patch(`${flagsPath(first)}/${firstFlag}`)
      .set(authorization)
      .send({ enabled: false })
      .expect(200);
    await createFlag({ ...first, environmentId: secondEnvironment }, 'staging-flag');
    await request(app.getHttpServer())
      .get(`${API_PREFIX}/projects/${first.projectId}/audit-logs`)
      .expect(401);

    await createFlag(otherProject, 'other-project-flag');

    const scoped = await request(app.getHttpServer())
      .get(`${API_PREFIX}/projects/${first.projectId}/audit-logs`)
      .set(authorization)
      .query({
        environmentId: first.environmentId,
        resourceType: 'feature-flag',
        action: 'post.create',
      })
      .expect(200);

    expect(scoped.body.data).toHaveLength(1);
    expect(scoped.body.data[0]).toMatchObject({
      projectId: first.projectId,
      environmentId: first.environmentId,
      resourceType: 'feature-flag',
      action: 'post.create',
      resourceId: 'scoped-flag',
    });

    const allFirstProjectLogs = await request(app.getHttpServer())
      .get(`${API_PREFIX}/projects/${first.projectId}/audit-logs`)
      .set(authorization)
      .expect(200);
    expect(allFirstProjectLogs.body.data.length).toBeGreaterThan(0);
    expect(allFirstProjectLogs.body.data.every((entry: { projectId: string }) => entry.projectId === first.projectId)).toBe(true);
    expect(JSON.stringify(allFirstProjectLogs.body)).not.toContain(otherProject.projectId);

    const otherProjectLogs = await request(app.getHttpServer())
      .get(`${API_PREFIX}/projects/${otherProject.projectId}/audit-logs`)
      .set(authorization)
      .expect(200);
    expect(otherProjectLogs.body.data.length).toBeGreaterThan(0);
    expect(otherProjectLogs.body.data.every((entry: { projectId: string }) => entry.projectId === otherProject.projectId)).toBe(true);
    expect(JSON.stringify(otherProjectLogs.body)).not.toContain(first.projectId);
  });

  it('returns stable cursor pages without duplicates or cross-page gaps', async () => {
    const project = await createProjectEnvironment('pagination');
    const createdFlags: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      createdFlags.push(await createFlag(project, `page-${index}`));
    }

    const firstPage = await request(app.getHttpServer())
      .get(`${API_PREFIX}/projects/${project.projectId}/audit-logs`)
      .set(authorization)
      .query({ resourceType: 'feature-flag', action: 'post.create', limit: 2 })
      .expect(200);
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.pagination.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app.getHttpServer())
      .get(`${API_PREFIX}/projects/${project.projectId}/audit-logs`)
      .set(authorization)
      .query({
        resourceType: 'feature-flag',
        action: 'post.create',
        limit: 2,
        cursor: firstPage.body.pagination.nextCursor,
      })
      .expect(200);
    expect(secondPage.body.data).toHaveLength(2);
    expect(secondPage.body.pagination.nextCursor).toEqual(expect.any(String));

    const thirdPage = await request(app.getHttpServer())
      .get(`${API_PREFIX}/projects/${project.projectId}/audit-logs`)
      .set(authorization)
      .query({
        resourceType: 'feature-flag',
        action: 'post.create',
        limit: 2,
        cursor: secondPage.body.pagination.nextCursor,
      })
      .expect(200);
    expect(thirdPage.body.data).toHaveLength(1);
    expect(thirdPage.body.pagination.nextCursor).toBeNull();

    const pageIds = [
      ...firstPage.body.data,
      ...secondPage.body.data,
      ...thirdPage.body.data,
    ].map((entry: { resourceId: string }) => entry.resourceId);
    expect(new Set(pageIds).size).toBe(5);
    expect(new Set(pageIds)).toEqual(new Set(createdFlags));
  });

  it('validates retention boundaries over HTTP and persists valid changes', async () => {
    const project = await createProject('retention-target');
    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/projects/${project}/audit-retention`)
      .set(authorization)
      .send({ retentionDays: 90 })
      .expect(200)
      .expect({ retentionDays: 90 });
    await request(app.getHttpServer())
      .get(`${API_PREFIX}/projects/${project}/audit-retention`)
      .set(authorization)
      .expect(200)
      .expect({ retentionDays: 90 });

    for (const body of [
      { retentionDays: 0 },
      { retentionDays: 3651 },
      { retentionDays: 1.5 },
      { retentionDays: '30' },
      {},
    ]) {
      await request(app.getHttpServer())
        .patch(`${API_PREFIX}/projects/${project}/audit-retention`)
        .set(authorization)
        .send(body)
        .expect(400);
    }

    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/projects/${project}/audit-retention`)
      .set(authorization)
      .send({ retentionDays: 30 })
      .expect(200)
      .expect({ retentionDays: 30 });

    await request(app.getHttpServer())
      .get(`${API_PREFIX}/projects/${project}/audit-retention`)
      .set(authorization)
      .expect(200)
      .expect({ retentionDays: 30 });
  });

  it('does not expose a generated SDK secret in audit entries', async () => {
    const project = await createProjectEnvironment('redaction');
    const created = await request(app.getHttpServer())
      .post(`${API_PREFIX}/projects/${project.projectId}/environments/${project.environmentId}/sdk-keys`)
      .set(authorization)
      .expect(201);
    const secret = created.body.key as string;
    expect(secret).toEqual(expect.any(String));

    const audit = await request(app.getHttpServer())
      .get(`${API_PREFIX}/projects/${project.projectId}/audit-logs`)
      .set(authorization)
      .query({ resourceType: 'sdk-key', action: 'post.create' })
      .expect(200);

    expect(audit.body.data).toHaveLength(1);
    expect(audit.body.data[0]).toMatchObject({
      projectId: project.projectId,
      environmentId: project.environmentId,
      resourceType: 'sdk-key',
      action: 'post.create',
      after: null,
      before: null,
    });
    expect(JSON.stringify(audit.body)).not.toContain(secret);
  });

  async function createProject(name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/projects`)
      .set(authorization)
      .send({ name: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}` })
      .expect(201);
    return response.body.id as string;
  }

  async function createEnvironment(projectId: string, name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/projects/${projectId}/environments`)
      .set(authorization)
      .send({ name })
      .expect(201);
    return response.body.id as string;
  }

  async function createProjectEnvironment(name: string): Promise<ProjectEnvironment> {
    const projectId = await createProject(name);
    const environmentId = await createEnvironment(projectId, 'production');
    return { projectId, environmentId };
  }

  async function createFlag(project: ProjectEnvironment, key: string): Promise<string> {
    await request(app.getHttpServer())
      .post(flagsPath(project))
      .set(authorization)
      .send({
        key,
        name: key,
        enabled: true,
        defaultValue: false,
        rollout: null,
        rules: [],
      })
      .expect(201);
    return key;
  }

  function flagsPath(project: ProjectEnvironment): string {
    return `${API_PREFIX}/projects/${project.projectId}/environments/${project.environmentId}/flags`;
  }
});
