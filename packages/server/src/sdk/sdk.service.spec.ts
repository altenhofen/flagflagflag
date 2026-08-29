import { describe, expect, it, vi } from 'vitest';
import { SdkService, hashKey } from './sdk.service.js';

function repository() {
  return { findOne: vi.fn(), find: vi.fn(), findOneBy: vi.fn().mockResolvedValue(null), save: vi.fn(), create: vi.fn((value) => value) };
}

describe('SdkService', () => {
  it('hashes SDK keys and resolves only non-revoked environment keys', async () => {
    const keys = repository();
    const environment = { id: 'staging-id', name: 'staging', projectId: 'project' };
    keys.findOne.mockResolvedValue({ revokedAt: null, environment });
    const service = new SdkService(keys, repository(), repository());
    await expect(service.authenticate('secret')).resolves.toEqual(environment);
    expect(keys.findOne).toHaveBeenCalledWith({ where: { keyHash: hashKey('secret') }, relations: { environment: true } });
  });
  it('serializes a complete environment config with stable versions', async () => {
    const flags = repository();
    flags.find.mockResolvedValue([{ name: 'checkout', enabled: true, percentage: 100, rules: [] }]);
    const versions = repository();
    versions.findOneBy.mockImplementation(async () => versions.save.mock.calls.at(-1)?.[0] ?? null);
    const service = new SdkService(repository(), flags, versions);
    const environment = { id: 'production-id', name: 'production', projectId: 'project' };
    const first = await service.config(environment);
    const second = await service.config(environment);
    expect(first).toEqual({ version: 1, environment: 'production', flags: { checkout: { key: 'checkout', enabled: true, defaultValue: true, rules: [] } } });
    expect(second.version).toBe(1);
    expect(versions.save).toHaveBeenCalledTimes(1);
  });
});
