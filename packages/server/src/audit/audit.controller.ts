import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from './audit.service.js';

const RetentionSchema = z.object({ retentionDays: z.number().int().min(1).max(3650) }).strict();
interface AuthRequest extends Request { user?: { sub: string } }

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
  ) {
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
      throw new BadRequestException('limit must be a positive integer');
    }
    const result = await this.audit.list({ projectId, environmentId, resourceType, action, limit: parsedLimit, cursor });
    return { data: result.data, pagination: { nextCursor: result.nextCursor } };
  }

  @Get('audit-retention')
  getRetention() {
    return this.audit.getRetention();
  }

  @Patch('audit-retention')
  setRetention(@Body() body: unknown, @Req() request: AuthRequest) {
    if (!request.user?.sub) throw new BadRequestException('Authenticated actor required');
    const parsed = RetentionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.audit.setRetention(parsed.data.retentionDays);
  }

  @Post('audit-retention/cleanup')
  cleanup() {
    return this.audit.cleanup();
  }
}
