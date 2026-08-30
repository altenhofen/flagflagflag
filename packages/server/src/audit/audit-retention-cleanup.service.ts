import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AuditService } from './audit.service.js';

export const AUDIT_RETENTION_CLEANUP_INTERVAL = Symbol(
  'AUDIT_RETENTION_CLEANUP_INTERVAL',
);
export const DEFAULT_AUDIT_RETENTION_CLEANUP_INTERVAL_MS = 86_400_000;

export function getAuditRetentionCleanupIntervalMs(): number {
  const configured = Number(process.env.AUDIT_RETENTION_CLEANUP_INTERVAL_MS);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_AUDIT_RETENTION_CLEANUP_INTERVAL_MS;
}

/**
 * Runs audit retention cleanup inside the server process. This service is
 * intentionally not exposed through a controller: deletion is an internal
 * maintenance operation, never a project-user action.
 */
@Injectable()
export class AuditRetentionCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AuditRetentionCleanupService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly audit: AuditService,
    @Inject(AUDIT_RETENTION_CLEANUP_INTERVAL)
    private readonly intervalMs = getAuditRetentionCleanupIntervalMs(),
  ) {}

  onModuleInit(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.run().catch(() => {
        // run logs the failure; keep the interval alive for the next attempt.
      });
    }, this.intervalMs);

    // A maintenance timer must not keep a process alive during shutdown. The
    // lifecycle hook still clears it explicitly when Nest closes the module.
    this.timer.unref();
    this.logger.log(
      `Audit retention cleanup scheduled every ${this.intervalMs}ms`,
    );
  }

  onModuleDestroy(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Run one cleanup with a caller-supplied instant for deterministic tests. */
  async run(now = new Date()): Promise<number> {
    if (this.running) {
      this.logger.warn('Audit retention cleanup skipped because one is running');
      return 0;
    }

    this.running = true;
    try {
      const deleted = await this.audit.cleanup(now);
      this.logger.log(
        `Audit retention cleanup completed: deleted=${deleted} at=${now.toISOString()}`,
      );
      return deleted;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown cleanup error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Audit retention cleanup failed: ${message}`, stack);
      throw error;
    } finally {
      this.running = false;
    }
  }
}
