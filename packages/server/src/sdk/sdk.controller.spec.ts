import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { SdkController, SdkKeyGuard } from './sdk.controller.js';

const environment = { id: 'production-id', name: 'production', projectId: 'project' };
const config = { schemaVersion: 1 as const, configVersion: 42, environment: { id: 'production-id', key: 'production' }, flags: {} };
function executionContext(request: Record<string, unknown>) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

describe('SDK transport', () => {
  it('authenticates SDK header keys and attaches their environment', async () => {
    const sdk = { authenticate: vi.fn().mockResolvedValue(environment) };
    const guard = new SdkKeyGuard(sdk as never);
    const request = { headers: { 'x-sdk-key': 'staging-key' } } as Record<string, unknown>;
    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true);
    expect(request.sdkEnvironment).toEqual(environment);
  });

  it('rejects absent keys and returns ETags or 304', async () => {
    const sdk = { authenticate: vi.fn() };
    const guard = new SdkKeyGuard(sdk as never);
    await expect(guard.canActivate(executionContext({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
    const controller = new SdkController({ config: vi.fn().mockResolvedValue(config) } as never);
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn(), json: vi.fn() };
    const request = { sdkEnvironment: environment, headers: {} };
    await controller.config(request as never, response as never);
    expect(response.setHeader).toHaveBeenCalledWith('ETag', '"42"');
    expect(response.json).toHaveBeenCalledWith(config);
    response.json.mockClear();
    await controller.config({ ...request, headers: { 'if-none-match': '"42"' } } as never, response as never);
    expect(response.status).toHaveBeenCalledWith(304);
    expect(response.send).toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
