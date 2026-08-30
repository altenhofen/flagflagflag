import { describe, expect, it, vi } from 'vitest';
import { AuditController } from './audit.controller.js';

function service() {
  return {
    list: vi.fn(),
    export: vi.fn(),
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

  it('passes every read filter to a JSON export and includes requested history', async () => {
    const audit = service();
    audit.export.mockResolvedValue({
      data: [
        {
          id: 'entry',
          projectId: 'project',
          createdAt: '2026-01-02T03:04:05.000Z',
          actorId: 'operator',
          action: 'update',
          resourceType: 'feature-flag',
          resourceId: 'checkout',
          environmentId: 'staging',
          summary: 'updated flag',
          before: { enabled: false },
          after: { enabled: true },
        },
      ],
      nextCursor: 'next',
    });
    const controller = new AuditController(audit);

    await expect(
      controller.export(
        'project',
        'staging',
        'feature-flag',
        'update',
        '25',
        'cursor',
        'json',
        'true',
        'false',
      ),
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'entry',
          before: { enabled: false },
          after: { enabled: true },
        }),
      ],
      pagination: { nextCursor: 'next' },
    });
    expect(audit.export).toHaveBeenCalledWith({
      projectId: 'project',
      environmentId: 'staging',
      resourceType: 'feature-flag',
      action: 'update',
      limit: 25,
      cursor: 'cursor',
      includeBefore: true,
      includeAfter: false,
    });
  });

  it('emits escaped CSV with readable fields and response headers', async () => {
    const audit = service();
    audit.export.mockResolvedValue({
      data: [
        {
          id: 'entry',
          projectId: 'project',
          createdAt: '2026-01-02T03:04:05.000Z',
          actorId: 'operator',
          action: 'update',
          resourceType: 'feature-flag',
          resourceId: 'checkout',
          environmentId: null,
          summary: 'updated, safely',
          before: { enabled: false },
          after: { enabled: true },
        },
      ],
      nextCursor: null,
    });
    const response = { setHeader: vi.fn() };
    const controller = new AuditController(audit);

    await expect(
      controller.export(
        'project',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
        'true',
        response,
        'text/csv',
      ),
    ).resolves.toContain(
      'id,projectId,createdAt,actorId,action,resourceType,resourceId,environmentId,summary,before,after',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="audit-logs.csv"',
    );
  });

  it.each([
    ['xml', undefined, undefined],
    ['json', 'not-a-number', undefined],
    ['json', undefined, 'yes'],
  ])('rejects invalid export filters (%s)', async (format, limit, includeBefore) => {
    const audit = service();
    const controller = new AuditController(audit);

    await expect(
      controller.export(
        'project',
        undefined,
        undefined,
        undefined,
        limit,
        undefined,
        format,
        includeBefore,
      ),
    ).rejects.toThrow();
    expect(audit.export).not.toHaveBeenCalled();
  });

  it('returns an explicit error when export fails unexpectedly', async () => {
    const audit = service();
    audit.export.mockRejectedValue(new Error('database unavailable'));
    const controller = new AuditController(audit);

    await expect(controller.export('project')).rejects.toThrow(
      'Audit export failed',
    );
  });
});
