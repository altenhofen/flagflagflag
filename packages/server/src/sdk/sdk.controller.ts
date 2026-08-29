import { AllowAnonymous } from '../auth/allow-anonymous.decorator.js';
import { CanActivate, Controller, Delete, ExecutionContext, Get, HttpCode, Injectable, Param, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { EnvironmentEntity } from '../environment/environment.entity.js';
import { ConfigEventService } from './config-events.js';
import { SdkService } from './sdk.service.js';

interface SdkRequest extends Request { sdkEnvironment?: EnvironmentEntity }

@Injectable()
export class SdkKeyGuard implements CanActivate {
  constructor(private readonly sdk: SdkService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SdkRequest>();
    const header = request.headers.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice(7)
      : request.headers['x-sdk-key'];
    if (typeof token !== 'string' || !token) throw new UnauthorizedException('SDK key required');
    request.sdkEnvironment = await this.sdk.authenticate(token);
    return true;
  }
}

@AllowAnonymous()
@Controller('sdk')
@UseGuards(SdkKeyGuard)
export class SdkController {
  constructor(
    private readonly sdk: SdkService,
    private readonly configEvents: ConfigEventService,
  ) {}

  @Get('events')
  events(@Req() request: SdkRequest, @Res() response: Response): void {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders?.();

    const subscription = this.configEvents.forEnvironment(request.sdkEnvironment!.id).subscribe({
      next: (event) => {
        response.write(`event: config.updated\ndata: ${JSON.stringify({ version: event.version })}\n\n`);
      },
    });
    const heartbeat = setInterval(() => {
      response.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
    }, 25000);
    request.on('close', () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
      response.end();
    });
  }

  @Get('config')
  async config(@Req() request: SdkRequest, @Res() response: Response): Promise<void> {
    const config = await this.sdk.config(request.sdkEnvironment!);
    const etag = `"${config.configVersion}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'private, max-age=30');
    if (request.headers['if-none-match'] === etag) {
      response.status(304).send();
      return;
    }
    response.json(config);
  }
}

@Controller('projects/:projectId/environments/:environmentId/sdk-keys')
export class SdkKeyManagementController {
  constructor(private readonly sdk: SdkService) {}

  @Get()
  list(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
  ) {
    return this.sdk.listKeys(projectId, environmentId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
  ) {
    return this.sdk.createKey(environmentId, projectId);
  }

  @Delete(':keyId')
  @HttpCode(204)
  revoke(
    @Param('projectId') projectId: string,
    @Param('environmentId') environmentId: string,
    @Param('keyId') keyId: string,
  ): Promise<void> {
    return this.sdk.revokeKey(projectId, environmentId, keyId);
  }
}
