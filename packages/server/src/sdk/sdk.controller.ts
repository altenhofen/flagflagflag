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
    const token = request.headers['x-sdk-key'];
    if (typeof token !== 'string' || !token) throw new UnauthorizedException('SDK key required');
    request.sdkEnvironment = await this.sdk.authenticate(token);
    return true;
  }
}

@AllowAnonymous()
@Controller('sdk')
@UseGuards(SdkKeyGuard)
export class SdkController {
  constructor(private readonly sdk: SdkService) {}

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
