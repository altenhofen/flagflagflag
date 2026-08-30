import { z } from 'zod';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  InternalServerErrorException,
  Param,
  Patch,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import type { AuditEntryEntity } from './audit.entity.js';
import type {
  AuditExportEntry,
  AuditExportResult,
} from './audit.service.js';
import { AuditService } from './audit.service.js';
const RetentionSchema = z
  .object({ retentionDays: z.number().int().min(1).max(3650) })
  .strict();

const ExportFormatSchema = z.enum(['csv', 'json']);
const ExportBooleanSchema = z.enum(['true', 'false']);

@Controller('projects/:projectId')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('audit-logs')
  async list(
    @Param('projectId') projectId: string,
    @Query('environmentId') environmentId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<{
    data: AuditEntryEntity[];
    pagination: { nextCursor: string | null };
  }> {
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    if (
      parsedLimit !== undefined &&
      (!Number.isInteger(parsedLimit) || parsedLimit < 1)
    ) {
      throw new BadRequestException('limit must be a positive integer');
    }
    const result = await this.audit.list({
      projectId,
      environmentId,
      resourceType,
      action,
      limit: parsedLimit,
      cursor,
    });
    return { data: result.data, pagination: { nextCursor: result.nextCursor } };
  }

  @Get('audit-logs/export')
  async export(
    @Param('projectId') projectId: string,
    @Query('environmentId') environmentId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('format') format?: string,
    @Query('includeBefore') includeBefore?: string,
    @Query('includeAfter') includeAfter?: string,
    @Res({ passthrough: true }) response?: Response,
    @Headers('accept') accept?: string,
  ): Promise<
    | { data: AuditExportEntry[]; pagination: { nextCursor: string | null } }
    | string
  > {
    const requestedFormat =
      format ?? (accept?.toLowerCase().includes('text/csv') ? 'csv' : 'json');
    const parsedFormat = ExportFormatSchema.safeParse(requestedFormat);
    if (!parsedFormat.success)
      throw new BadRequestException('format must be csv or json');
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    if (
      parsedLimit !== undefined &&
      (!Number.isInteger(parsedLimit) || parsedLimit < 1)
    )
      throw new BadRequestException('limit must be a positive integer');
    const parsedBefore = parseExportBoolean(includeBefore, 'includeBefore');
    const parsedAfter = parseExportBoolean(includeAfter, 'includeAfter');

    try {
      const result = await this.audit.export({
        projectId,
        environmentId,
        resourceType,
        action,
        limit: parsedLimit,
        cursor,
        includeBefore: parsedBefore,
        includeAfter: parsedAfter,
      });
      if (parsedFormat.data === 'json') {
        if (response) {
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader(
            'Content-Disposition',
            'attachment; filename="audit-logs.json"',
          );
        }
        return {
          data: result.data,
          pagination: { nextCursor: result.nextCursor },
        };
      }

      const csv = toCsv(result.data, parsedBefore === true, parsedAfter === true);
      if (response) {
        response.setHeader('Content-Type', 'text/csv; charset=utf-8');
        response.setHeader(
          'Content-Disposition',
          'attachment; filename="audit-logs.csv"',
        );
        if (result.nextCursor)
          response.setHeader('X-Next-Cursor', result.nextCursor);
      }
      return csv;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Audit export failed');
    }
  }

  @Get('audit-retention')
  getRetention(): Promise<{ retentionDays: number }> {
    return this.audit.getRetention();
  }

  @Patch('audit-retention')
  async setRetention(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,

  ): Promise<{ retentionDays: number }> {
    if (!request.user?.sub)
      throw new BadRequestException('Authenticated actor required');
    const parsed = RetentionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.audit.setRetention(parsed.data.retentionDays);
  }
}
function parseExportBoolean(
  value: string | undefined,
  name: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  const parsed = ExportBooleanSchema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException(`${name} must be true or false`);
  return parsed.data === 'true';
}

function toCsv(
  entries: AuditExportEntry[],
  includeBefore: boolean,
  includeAfter: boolean,
): string {
  const fields = [
    'id',
    'projectId',
    'createdAt',
    'actorId',
    'action',
    'resourceType',
    'resourceId',
    'environmentId',
    'summary',
    ...(includeBefore ? ['before'] : []),
    ...(includeAfter ? ['after'] : []),
  ] as Array<keyof AuditExportEntry>;
  const rows = [
    fields,
    ...entries.map((entry) =>
      fields.map((field) => csvValue(entry[field])),
    ),
  ];
  return `${rows.map((row) => row.join(',')).join('\r\n')}\r\n`;
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
