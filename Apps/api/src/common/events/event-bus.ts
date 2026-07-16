import { EventEmitter } from 'node:events';

// EXTENSION POINT (events): describe your event payloads here, e.g.
//   interface AppEvents {
//     'resource:updated': { id: string; timestamp: string };
//   }
// With no events declared, emit/on are uncallable by design (keyof AppEvents = never).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AppEvents {}

type Listener = (...args: unknown[]) => void;

class TypedBus {
  private emitter = new EventEmitter();

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    this.emitter.emit(event as string, payload);
  }

  on<K extends keyof AppEvents>(event: K, handler: (payload: AppEvents[K]) => void): void {
    this.emitter.on(event as string, handler as Listener);
  }

  off<K extends keyof AppEvents>(event: K, handler: (payload: AppEvents[K]) => void): void {
    this.emitter.off(event as string, handler as Listener);
  }
}

export const eventBus = new TypedBus();
