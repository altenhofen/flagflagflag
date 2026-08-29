import { AllowAnonymous } from '../auth/allow-anonymous.decorator.js';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service.js';
import type { FeatureFlag } from './feature-flag.service.js';
import {
  CreateFeatureFlagSchema,
  GetFeatureFlagSchema,
  UpdateFeatureFlagSchema,
} from './schemas.js';

@Controller('feature-flags')
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get()
  async list(@Query() query: unknown): Promise<FeatureFlag[]> {
    const parsed = GetFeatureFlagSchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.featureFlagService.list(
      parsed.data.environment,
      parsed.data.projectId,
    );
  }

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
      parsed.data.percentage,
    );
  }

  @Patch(':name')
  async update(
    @Param('name') name: string,
    @Query() query: unknown,
    @Body() body: unknown,
  ): Promise<FeatureFlag> {
    const context = GetFeatureFlagSchema.safeParse(query ?? {});
    const update = UpdateFeatureFlagSchema.safeParse(body);
    if (!context.success || !update.success) {
      throw new BadRequestException([
        ...(context.success ? [] : context.error.issues),
        ...(update.success ? [] : update.error.issues),
      ]);
    }

    return this.featureFlagService.update(
      name,
      update.data.enabled,
      context.data.environment,
      context.data.projectId,
      update.data.percentage,
    );
  }

  @Delete(':name')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('name') name: string,
    @Query() query: unknown,
  ): Promise<void> {
    const parsed = GetFeatureFlagSchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    await this.featureFlagService.remove(
      name,
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