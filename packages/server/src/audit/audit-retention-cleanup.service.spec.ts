import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuditRetentionCleanupService,
  DEFAULT_AUDIT_RETENTION_CLEANUP_INTERVAL_MS,
} from './audit-retention-cleanup.service.js';

function auditService() {
  return { cleanup: vi.fn() };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AuditRetentionCleanupService', () => {
  it('runs cleanup at the supplied instant and reports the deleted count', async () => {
    const audit = auditService();
    audit.cleanup.mockResolvedValue(3);
    const logger = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const scheduler = new AuditRetentionCleanupService(audit);
    const now = new Date('2026-08-29T12:34:56.789Z');

    await expect(scheduler.run(now)).resolves.toBe(3);

    expect(audit.cleanup).toHaveBeenCalledWith(now);
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining(
        'Audit retention cleanup completed: deleted=3 at=2026-08-29T12:34:56.789Z',
      ),
    );
  });

  it('logs failures and allows the next scheduled attempt to run', async () => {
    const audit = auditService();
    const logger = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const scheduler = new AuditRetentionCleanupService(audit);
    const failure = new Error('database unavailable');
    audit.cleanup.mockRejectedValueOnce(failure).mockResolvedValueOnce(0);

    await expect(
      scheduler.run(new Date('2026-08-29T00:00:00.000Z')),
    ).rejects.toThrow('database unavailable');
    await expect(
      scheduler.run(new Date('2026-08-30T00:00:00.000Z')),
    ).resolves.toBe(0);

    expect(logger).toHaveBeenCalledWith(
      'Audit retention cleanup failed: database unavailable',
      failure.stack,
    );
  });

  it('schedules recurring cleanup and releases its timer on module destroy', async () => {
    vi.useFakeTimers();
    const audit = auditService();
    audit.cleanup.mockResolvedValue(1);
    const scheduler = new AuditRetentionCleanupService(audit, 10);

    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(10);
    expect(audit.cleanup).toHaveBeenCalledTimes(1);

    scheduler.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(30);
    expect(audit.cleanup).toHaveBeenCalledTimes(1);
  });

  it('uses a daily interval by default', () => {
    vi.useFakeTimers();
    const audit = auditService();
    const interval = vi.spyOn(globalThis, 'setInterval');
    const scheduler = new AuditRetentionCleanupService(audit);

    scheduler.onModuleInit();

    expect(interval).toHaveBeenCalledWith(
      expect.any(Function),
      DEFAULT_AUDIT_RETENTION_CLEANUP_INTERVAL_MS,
    );
    scheduler.onModuleDestroy();
  });
});
