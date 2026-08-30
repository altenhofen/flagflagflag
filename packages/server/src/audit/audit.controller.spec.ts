import { describe, expect, it, vi } from 'vitest';
import { AuditController } from './audit.controller.js';

function service() {
  return {
    list: vi.fn(),
    getRetention: vi.fn().mockResolvedValue({ retentionDays: 90 }),
    setRetention: vi.fn().mockResolvedValue({ retentionDays: 30 }),
  };
}

describe('AuditController', () => {
  it('rejects retention changes without an authenticated actor', async () => {
    const audit = service();
    const controller = new AuditController(audit);

    await expect(
      controller.setRetention({ retentionDays: 30 }, {}),
    ).rejects.toThrow('Authenticated actor required');
    expect(audit.setRetention).not.toHaveBeenCalled();
  });

  it('returns filtered audit data with pagination', async () => {
    const audit = service();
    audit.list.mockResolvedValue({ data: [], nextCursor: null });
    const controller = new AuditController(audit);

    await expect(
      controller.list('project', 'staging', 'feature-flag', 'update', '25'),
    ).resolves.toEqual({
      data: [],
      pagination: { nextCursor: null },
    });
    expect(audit.list).toHaveBeenCalledWith({
      projectId: 'project',
      environmentId: 'staging',
      resourceType: 'feature-flag',
      action: 'update',
      limit: 25,
      cursor: undefined,
    });
  });
});
