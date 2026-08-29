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
  ): Promise<FeatureFlag> {
    const parsed = CreateFeatureFlagSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.featureFlagService.create(projectId, environmentId, parsed.data);
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
