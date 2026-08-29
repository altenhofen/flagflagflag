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
} from '@nestjs/common';
import { EnvironmentService } from './environment.service.js';
import type { Environment } from './environment.service.js';
import { CreateEnvironmentSchema, UpdateEnvironmentSchema } from './schemas.js';

@Controller('projects/:projectId/environments')
export class EnvironmentController {
  constructor(private readonly environmentService: EnvironmentService) {}

  @Get()
  async list(@Param('projectId') projectId: string): Promise<{
    data: Environment[];
    pagination: { nextCursor: null };
  }> {
    return {
      data: await this.environmentService.list(projectId),
      pagination: { nextCursor: null },
    };
  }

  @Get(':id')
  get(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<Environment> {
    return this.environmentService.get(projectId, id);
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ): Promise<Environment> {
    const parsed = CreateEnvironmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.environmentService.create(projectId, parsed.data.name);
  }

  @Patch(':id')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Environment> {
    const parsed = UpdateEnvironmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.environmentService.update(projectId, id, parsed.data.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.environmentService.remove(projectId, id);
  }
}