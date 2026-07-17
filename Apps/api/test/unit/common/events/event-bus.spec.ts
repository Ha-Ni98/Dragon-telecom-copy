import { describe, it, expect, vi } from 'vitest';
import { AuthType } from '@dragon-telecom/contract';
import { eventBus } from '../../../../src/common/events/event-bus';

describe('event-bus', () => {
  it('delivers an emitted payload to a registered handler', () => {
    const handler = vi.fn();
    eventBus.on('auth.loggedIn', handler);

    const payload = { userId: 'user-1', authType: AuthType.STAFF };
    eventBus.emit('auth.loggedIn', payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });
});
