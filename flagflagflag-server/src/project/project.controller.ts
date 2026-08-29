import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ProjectService } from './project.service.js';
import type { Project } from './project.service.js';
import { CreateProjectSchema } from './schemas.js';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  async create(@Body() body: unknown): Promise<Project> {
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.projectService.create(parsed.data.name);
  }
}
