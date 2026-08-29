import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Patch,
  Post,
} from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service.js';
import type { FeatureFlag } from './feature-flag.service.js';
import {
  CreateFeatureFlagSchema,
  UpdateFeatureFlagSchema,
} from './schemas.js';

@Controller('projects/:projectId/environments/:environmentId/flags')
export class FeatureFlagController {
  private readonly idempotentCreates = new Map<string, FeatureFlag>();
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get()
  async list(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<{ data: FeatureFlag[]; pagination: { nextCursor: null } }> {
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return {
      data: await this.featureFlagService.list(projectId, environmentId, { limit: parsedLimit, cursor }),
      pagination: { nextCursor: null },
    };
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<FeatureFlag> {
    const parsed = CreateFeatureFlagSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const cacheKey = idempotencyKey
      ? `${projectId}:${environmentId}:${idempotencyKey}`
      : undefined;
    const cached = cacheKey ? this.idempotentCreates.get(cacheKey) : undefined;
    if (cached) return cached;
    const created = await this.featureFlagService.create(projectId, environmentId, parsed.data);
    if (cacheKey) this.idempotentCreates.set(cacheKey, created);
    return created;
  }

  @Get(':flagKey')
  get(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Param('flagKey') flagKey: string,
  ): Promise<FeatureFlag> {
    return this.featureFlagService.get(projectId, environmentId, flagKey);
  }

  @Patch(':flagKey')
  async update(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Param('flagKey') flagKey: string,
    @Body() body: unknown,
    @Headers('if-match') ifMatch: string | undefined,
  ): Promise<FeatureFlag> {
    const parsed = UpdateFeatureFlagSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const normalized = ifMatch?.replace(/^"|"$/g, '');
    return this.featureFlagService.update(
      projectId,
      environmentId,
      flagKey,
      parsed.data,
      normalized && /^\d+$/.test(normalized) ? Number(normalized) : undefined,
    );
  }

  @Delete(':flagKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Param('flagKey') flagKey: string,
  ): Promise<void> {
    return this.featureFlagService.remove(projectId, environmentId, flagKey);
  }
}
