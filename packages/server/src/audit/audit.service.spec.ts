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

    expect(entries.save).toHaveBeenCalledWith(expect.objectContaining({
      after: { prefix: 'ff_' },
      before: null,
    }));
  });

  it('uses the default retention and validates configured values', async () => {
    const entries = repository();
    const retention = repository();
    retention.findOneBy.mockResolvedValue(undefined);
    const service = new AuditService(entries, retention);

    await expect(service.getRetention()).resolves.toEqual({ retentionDays: 90 });
    await expect(service.setRetention(0)).rejects.toThrow('retentionDays');
    await expect(service.setRetention(30)).resolves.toEqual({ retentionDays: 30 });
    expect(retention.save).toHaveBeenCalledWith({ id: 'default', retentionDays: 30 });
  });
});
