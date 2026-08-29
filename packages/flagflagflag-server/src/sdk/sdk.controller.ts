import { AllowAnonymous } from '../auth/allow-anonymous.decorator.js';
import { CanActivate, Controller, ExecutionContext, Get, Injectable, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { EnvironmentEntity } from '../environment/environment.entity.js';
import { SdkService } from './sdk.service.js';

interface SdkRequest extends Request { sdkEnvironment?: EnvironmentEntity }

@Injectable()
export class SdkKeyGuard implements CanActivate {
  constructor(private readonly sdk: SdkService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SdkRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('SDK key required');
    request.sdkEnvironment = await this.sdk.authenticate(token);
    return true;
  }
}

@AllowAnonymous()
@Controller('sdk/v1')
@UseGuards(SdkKeyGuard)
export class SdkController {
  constructor(private readonly sdk: SdkService) {}

  @Get('config')
  async config(@Req() request: SdkRequest, @Res() response: Response): Promise<void> {
    const config = await this.sdk.config(request.sdkEnvironment!);
    const etag = `"${config.version}"`;
    response.setHeader('ETag', etag);
    if (request.headers['if-none-match'] === etag) {
      response.status(304).send();
      return;
    }
    response.json(config);
  }
}
