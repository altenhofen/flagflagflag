import { AllowAnonymous } from '../auth/allow-anonymous.decorator.js';
import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  HttpCode,
  HttpException,
  HttpStatus,
  Injectable,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RuntimeEvaluationService } from './runtime-evaluation.service.js';
import { BatchEvaluateRequestSchema, EvaluateRequestSchema } from './schemas.js';

@Injectable()
export class RuntimeRateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, number[]>();
  private readonly limit = 100;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const recent = (this.requests.get(key) ?? []).filter((time) => now - time < this.windowMs);
    if (recent.length >= this.limit) {
      throw new HttpException('Evaluation rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }
}

@AllowAnonymous()
@Controller('evaluate')
@UseGuards(RuntimeRateLimitGuard)
export class RuntimeEvaluationController {
  constructor(private readonly evaluation: RuntimeEvaluationService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async evaluate(@Body() body: unknown) {
    const parsed = EvaluateRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.evaluation.evaluate(parsed.data);
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async evaluateBatch(@Body() body: unknown) {
    const parsed = BatchEvaluateRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return { results: await this.evaluation.evaluateBatch(parsed.data) };
  }
}
