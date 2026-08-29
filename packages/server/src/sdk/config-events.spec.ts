import { describe, expect, it, vi } from 'vitest';
import { ConfigEventService } from './config-events.js';

describe('ConfigEventService', () => {
  it('publishes only to subscribers for the matching environment', () => {
    const events = new ConfigEventService();
    const own = vi.fn();
    const other = vi.fn();
    const ownSubscription = events.forEnvironment('production').subscribe(own);
    const otherSubscription = events.forEnvironment('staging').subscribe(other);

    events.publish({ environmentId: 'production', version: 43 });

    expect(own).toHaveBeenCalledWith({ environmentId: 'production', version: 43 });
    expect(other).not.toHaveBeenCalled();
    ownSubscription.unsubscribe();
    otherSubscription.unsubscribe();
  });
});
