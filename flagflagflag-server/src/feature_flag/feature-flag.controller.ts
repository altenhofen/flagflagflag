import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service.js';
import type { FeatureFlag } from './feature-flag.service.js';
import {
  CreateFeatureFlagSchema,
  GetFeatureFlagSchema,
} from './schemas.js';

@Controller('feature-flags')
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Post()
  async create(@Body() body: unknown): Promise<FeatureFlag> {
    const parsed = CreateFeatureFlagSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return this.featureFlagService.create(
      parsed.data.name,
      parsed.data.enabled,
      parsed.data.environment,
      parsed.data.projectId,
    );
  }

  @AllowAnonymous()
  @Get(':name')
  async get(
    @Param('name') name: string,
    @Query() query: unknown,
  ): Promise<{ enabled: boolean }> {
    const parsed = GetFeatureFlagSchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return {
      enabled: await this.featureFlagService.isEnabled(
        name,
        parsed.data.environment,
        parsed.data.projectId,
      ),
    };
  }
}
