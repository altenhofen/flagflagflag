import { describe, expect, it, vi } from 'vitest';
import { SdkService, hashKey } from './sdk.service.js';

function repository() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    findOneBy: vi.fn().mockResolvedValue(null),
    save: vi.fn(),
    create: vi.fn((value) => value),
  };
}

describe('SdkService', () => {
  it('hashes SDK keys and resolves only non-revoked environment keys', async () => {
    const keys = repository();
    const environment = { id: 'staging-id', name: 'staging', projectId: 'project' };
    keys.findOne.mockResolvedValue({ revokedAt: null, environment });
    const service = new SdkService(keys, repository(), repository());

    await expect(service.authenticate('secret')).resolves.toEqual(environment);
    expect(keys.findOne).toHaveBeenCalledWith({
      where: { keyHash: hashKey('secret') },
      relations: { environment: true },
    });
  });

  it('serializes stable flag keys, defaults, rollouts, and config versions', async () => {
    const flags = repository();
    flags.find.mockResolvedValue([
      {
        key: 'new-checkout',
        name: 'New checkout',
        enabled: true,
        defaultValue: false,
        rollout: { percentage: 25, attribute: 'userId' },
        rules: [],
      },
    ]);
    const versions = repository();
    versions.findOneBy.mockImplementation(
      async () => versions.save.mock.calls.at(-1)?.[0] ?? null,
    );
    const service = new SdkService(repository(), flags, versions);
    const environment = { id: 'production-id', name: 'production', projectId: 'project' };
    const first = await service.config(environment);
    const second = await service.config(environment);

    expect(first).toEqual({
      schemaVersion: 1,
      configVersion: 1,
      environment: { id: 'production-id', key: 'production' },
      flags: {
        'new-checkout': {
          key: 'new-checkout',
          name: 'New checkout',
          enabled: true,
          defaultValue: false,
          rollout: { percentage: 25, attribute: 'userId' },
          rules: [],
        },
      },
    });
    expect(second.configVersion).toBe(1);
    expect(versions.save).toHaveBeenCalledTimes(1);
  });
});
