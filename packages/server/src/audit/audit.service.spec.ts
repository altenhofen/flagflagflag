import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';

function repository() {
  return {
    create: vi.fn((value: unknown) => value),
    save: vi.fn(),
    findOneBy: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
}

describe('AuditService', () => {
  it('records entries without secrets in before or after data', async () => {
    const entries = repository();
    const retention = repository();
    const service = new AuditService(entries, retention);

    await service.record({
      projectId: 'project',
      actorId: 'user',
      action: 'create',
      resourceType: 'sdk-key',
      resourceId: 'key',
      summary: 'created SDK key',
      after: { prefix: 'ff_', key: 'raw-secret', keyHash: 'hash' },
    });

    expect(entries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        after: { prefix: 'ff_' },
        before: null,
      }),
    );
  });

  it('uses the default retention and validates configured values', async () => {
    const entries = repository();
    const retention = repository();
    retention.findOneBy.mockResolvedValue(undefined);
    const service = new AuditService(entries, retention);

    await expect(service.getRetention()).resolves.toEqual({
      retentionDays: 90,
    });
    await expect(service.setRetention(0)).rejects.toThrow('retentionDays');
    await expect(service.setRetention(30)).resolves.toEqual({
      retentionDays: 30,
    });
    expect(retention.save).toHaveBeenCalledWith({
      id: 'default',
      retentionDays: 30,
    });
  });

  it('applies project filters and returns a stable next cursor', async () => {
    const entries = repository();
    const retention = repository();
    const rows = [
      { id: 'new', createdAt: new Date('2026-01-02T00:00:00.000Z') },
      { id: 'old', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'more', createdAt: new Date('2025-12-31T00:00:00.000Z') },
    ];
    const queryBuilder = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(rows),
    };
    entries.createQueryBuilder.mockReturnValue(queryBuilder);
    const service = new AuditService(entries, retention);

    const result = await service.list({
      projectId: 'project',
      environmentId: 'staging',
      resourceType: 'feature-flag',
      action: 'update',
      limit: 2,
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'audit.environmentId = :environmentId',
      { environmentId: 'staging' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'audit.resourceType = :resourceType',
      { resourceType: 'feature-flag' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'audit.action = :action',
      { action: 'update' },
    );
    expect(result.data).toEqual(rows.slice(0, 2));
    expect(result.nextCursor).toBeTruthy();
  });

  it('deletes only entries older than the configured retention cutoff', async () => {
    const entries = repository();
    const retention = repository();
    retention.findOneBy.mockResolvedValue({ id: 'default', retentionDays: 30 });
    const queryBuilder = {
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 2 }),
    };
    entries.createQueryBuilder.mockReturnValue(queryBuilder);
    const service = new AuditService(entries, retention);

    await expect(
      service.cleanup(new Date('2026-02-01T00:00:00.000Z')),
    ).resolves.toBe(2);
    expect(queryBuilder.where).toHaveBeenCalledWith('createdAt < :cutoff', {
      cutoff: new Date('2026-01-02T00:00:00.000Z'),
    });
  });
});
