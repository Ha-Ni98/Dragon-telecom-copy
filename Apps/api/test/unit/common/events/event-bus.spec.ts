import { describe, it, expect, vi } from 'vitest';
import { eventBus } from '@common/events/event-bus';

// The template ships with no declared events, so the typed API is uncallable by design
// (keyof AppEvents = never). These tests exercise the underlying delivery mechanics through
// an untyped view — once you declare events in AppEvents, call eventBus.on/emit directly.
type UntypedBus = {
  on: (event: string, handler: (payload: unknown) => void) => void;
  off: (event: string, handler: (payload: unknown) => void) => void;
  emit: (event: string, payload: unknown) => void;
};
const bus = eventBus as unknown as UntypedBus;

describe('eventBus', () => {
  it('delivers an emitted payload to subscribed handlers', () => {
    const handler = vi.fn();
    const payload = { id: 'a1b2c3d4', timestamp: new Date().toISOString() };

    bus.on('resource:updated', handler);
    bus.emit('resource:updated', payload);
    bus.off('resource:updated', handler);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('does not deliver to a handler that was removed', () => {
    const handler = vi.fn();
    bus.on('resource:updated', handler);
    bus.off('resource:updated', handler);

    bus.emit('resource:updated', { id: 'a1b2c3d4', timestamp: new Date().toISOString() });

    expect(handler).not.toHaveBeenCalled();
  });
});
