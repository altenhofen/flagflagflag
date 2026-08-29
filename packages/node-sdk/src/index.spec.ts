import { describe, expect, it, vi } from 'vitest';
import { FlagsClient } from './index.js';
const config = {
  schemaVersion: 1,
  configVersion: 1,
  environment: { id: 'production-id', key: 'production' },
  flags: { x: { key: 'x', enabled: true, defaultValue: true, rollout: null, rules: [] } },
};
function response(status: number, body: unknown, etag = '"1"'): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { ETag: etag } });
}

describe('FlagsClient', () => {
  it('loads once and evaluates locally without further HTTP', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, config));
    const client = new FlagsClient({ sdkKey: 'key', baseUrl: 'http://flags', fetch: fetcher });
    await client.initialize();
    expect(client.isEnabled('x', {})).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(client.evaluate('missing', {}, true)).toEqual({ value: true, reason: 'FLAG_NOT_FOUND' });
    client.close();
  });
  it('preserves the snapshot after 304, invalid JSON, and failed refreshes', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, config))
      .mockResolvedValueOnce(response(200, undefined))
      .mockResolvedValueOnce(response(304, undefined))
      .mockResolvedValueOnce(response(200, { version: 'bad' }))
      .mockRejectedValueOnce(new Error('offline'));
    const client = new FlagsClient({ sdkKey: 'key', baseUrl: 'http://flags', fetch: fetcher });
    await client.initialize();
    expect(await client.refresh()).toBe(true);
    expect(await client.refresh()).toBe(false);
    expect(client.isEnabled('x', {})).toBe(true);
    client.close();
  });
  it('uses fallback with no config and prevents overlapping refreshes', async () => {
    let resolve!: (value: Response) => void;
    const pending = new Promise<Response>((done) => { resolve = done; });
    const fetcher = vi.fn().mockReturnValue(pending);
    const client = new FlagsClient({ sdkKey: 'key', baseUrl: 'http://flags', fetch: fetcher });
    const first = client.refresh();
    const second = client.refresh();
    expect(client.evaluate('x', {}, true)).toEqual({ value: true, reason: 'NO_CONFIG' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve(response(200, config));
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    client.close();
  });

  it('refreshes from a newer config.updated event without remote evaluation', async () => {
    const updated = { ...config, configVersion: 2, flags: { x: { ...config.flags.x, enabled: false } } };
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: config.updated\ndata: {"version":2}\n\n'));
        controller.close();
      },
    });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, config))
      .mockResolvedValueOnce(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
      .mockResolvedValueOnce(response(200, updated, '"2"'));
    const client = new FlagsClient({ sdkKey: 'key', baseUrl: 'http://flags', fetch: fetcher });

    await client.initialize();
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 0);
    await promise;
    expect(client.isEnabled('x', {})).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
    client.close();
  });
});
