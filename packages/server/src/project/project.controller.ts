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
import { ProjectService } from './project.service.js';
import type { Project } from './project.service.js';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
} from './schemas.js';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  async list(): Promise<{
    data: Project[];
    pagination: { nextCursor: null };
  }> {
    return {
      data: await this.projectService.list(),
      pagination: { nextCursor: null },
    };
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<Project> {
    return this.projectService.get(id);
  }

  @Post()
  async create(@Body() body: unknown): Promise<Project> {
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.projectService.create(parsed.data.name);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Project> {
    const parsed = UpdateProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.projectService.update(id, parsed.data.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.projectService.remove(id);
  }
}