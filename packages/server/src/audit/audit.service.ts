import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import { AuditEntryEntity } from './audit.entity.js';
import { AuditRetentionEntity } from './audit-retention.entity.js';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');
export const AUDIT_RETENTION_REPOSITORY = Symbol('AUDIT_RETENTION_REPOSITORY');
export const DEFAULT_RETENTION_DAYS = 90;

export interface AuditRecord {
  projectId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  environmentId?: string;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface AuditQuery {
  projectId: string;
  environmentId?: string;
  resourceType?: string;
  action?: string;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly repository: Repository<AuditEntryEntity>,
    @Inject(AUDIT_RETENTION_REPOSITORY)
    private readonly retention: Repository<AuditRetentionEntity>,
  ) {}

  async record(input: AuditRecord): Promise<void> {
    const entry = this.repository.create({
      ...input,
      id: randomUUID(),
      environmentId: input.environmentId ?? null,
      before: redact(input.before),
      after: redact(input.after),
    });
    await this.repository.save(entry);
  }

  async list(
    query: AuditQuery,
  ): Promise<{ data: AuditEntryEntity[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const qb = this.repository
      .createQueryBuilder('audit')
      .where('audit.projectId = :projectId', { projectId: query.projectId })
      .orderBy('audit.createdAt', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .take(limit + 1);
    if (query.environmentId)
      qb.andWhere('audit.environmentId = :environmentId', {
        environmentId: query.environmentId,
      });
    if (query.resourceType)
      qb.andWhere('audit.resourceType = :resourceType', {
        resourceType: query.resourceType,
      });
    if (query.action)
      qb.andWhere('audit.action = :action', { action: query.action });
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      qb.andWhere(
        '(audit.createdAt < :cursorDate OR (audit.createdAt = :cursorDate AND audit.id < :cursorId))',
        decoded,
      );
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    return {
      data,
      nextCursor: hasMore ? encodeCursor(data[data.length - 1]) : null,
    };
  }

  async getRetention(): Promise<{ retentionDays: number }> {
    const config = await this.retention.findOneBy({ id: 'default' });
    return { retentionDays: config?.retentionDays ?? DEFAULT_RETENTION_DAYS };
  }

  async setRetention(
    retentionDays: number,
  ): Promise<{ retentionDays: number }> {
    if (
      !Number.isInteger(retentionDays) ||
      retentionDays < 1 ||
      retentionDays > 3650
    ) {
      throw new BadRequestException(
        'retentionDays must be an integer between 1 and 3650',
      );
    }
    const config = this.retention.create({ id: 'default', retentionDays });
    await this.retention.save(config);
    return { retentionDays };
  }

  async cleanup(now = new Date()): Promise<number> {
    const { retentionDays } = await this.getRetention();
    const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(AuditEntryEntity)
      .where('createdAt < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}

function encodeCursor(entry: AuditEntryEntity): string {
  return Buffer.from(
    JSON.stringify({ date: entry.createdAt.toISOString(), id: entry.id }),
  ).toString('base64url');
}

function decodeCursor(cursor: string): {
  cursorDate: string;
  cursorId: string;
} {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as { date?: string; id?: string };
    if (!parsed.date || !parsed.id) throw new Error();
    return { cursorDate: parsed.date, cursorId: parsed.id };
  } catch {
    throw new BadRequestException('Invalid audit cursor');
  }
}

function redact(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      /^(key|password|secret|token|privatekey|api[-_]?key)$/i.test(key) ||
      /hash/i.test(key)
    )
      continue;
    output[key] = item;
  }
  return output;
}
