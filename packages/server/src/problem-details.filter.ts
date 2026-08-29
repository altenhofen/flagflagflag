import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const codes: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'AUTHENTICATION_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  412: 'PRECONDITION_FAILED',
  429: 'RATE_LIMITED',
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = typeof request.headers['x-request-id'] === 'string'
      ? request.headers['x-request-id']
      : `req_${randomUUID()}`;
    response.setHeader('X-Request-Id', requestId);
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof exceptionResponse === 'object' && exceptionResponse !== null
      ? (exceptionResponse as { message?: unknown }).message
      : undefined;
    const detail = typeof exceptionResponse === 'string'
      ? exceptionResponse
      : status === 400 ? 'One or more request fields are invalid.' : 'An unexpected error occurred.';
    const errors = Array.isArray(message)
      ? message.map((item) => ({ field: '', code: 'invalid', message: String(item) }))
      : undefined;
    response.status(status).json({
      type: `https://docs.flagflagflag.dev/errors/${(codes[status] ?? 'INTERNAL_ERROR').toLowerCase()}`,
      title: status === 400 ? 'Request validation failed' : HttpStatus[status] ?? 'Error',
      status,
      code: codes[status] ?? 'INTERNAL_ERROR',
      detail,
      instance: request.originalUrl,
      requestId,
      ...(errors ? { errors } : {}),
    });
  }
}
