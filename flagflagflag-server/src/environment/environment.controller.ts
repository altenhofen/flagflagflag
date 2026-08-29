import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
} from '@nestjs/common';
import { EnvironmentService } from './environment.service.js';
import type { Environment } from './environment.service.js';
import { CreateEnvironmentSchema } from './schemas.js';

@Controller('projects/:projectId/environments')
export class EnvironmentController {
  constructor(private readonly environmentService: EnvironmentService) {}

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
}
