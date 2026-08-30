import { describe, expect, it, vi } from 'vitest';
import { AuditInterceptor } from './audit.interceptor.js';

describe('AuditInterceptor', () => {
  it('uses created resource identifiers from collection responses', async () => {
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const interceptor = new AuditInterceptor(audit);
    const request = {
      method: 'POST',
      path: '/projects/project/environments/staging/flags',
      user: { sub: 'user' },
      body: { key: 'checkout' },
    } as never;

    await (
      interceptor as unknown as {
        record(request: never, response: unknown): Promise<void>;
      }
    ).record(request, { key: 'checkout' });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project',
        resourceType: 'feature-flag',
        resourceId: 'checkout',
      }),
    );
  });
});
