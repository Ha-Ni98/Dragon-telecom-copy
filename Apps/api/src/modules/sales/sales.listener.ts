import { logger } from '@common/config/logger';
import { eventBus } from '@common/events/event-bus';
import type { ISalesService } from './sales.interface';

// Subscribes to this module's own post-commit repair.pickedUp (records a REPAIR-origin sale —
// plan §I.2). Mirrors clients.listener.ts's safeRun guard: a throw/rejection here must never
// propagate back into eventBus.emit()'s synchronous dispatch.
export class SalesListener {
  constructor(private service: ISalesService) {}

  setup(): void {
    eventBus.on('repair.pickedUp', (payload) =>
      this.safeRun('repair.pickedUp', () => this.service.recordRepairSale(payload)),
    );
  }

  private safeRun(eventName: string, fn: () => Promise<void>): void {
    try {
      void fn().catch((err: unknown) => {
        logger.error({ err, event: eventName }, 'sales listener failed to record an event');
      });
    } catch (err) {
      logger.error({ err, event: eventName }, 'sales listener failed to record an event');
    }
  }
}
