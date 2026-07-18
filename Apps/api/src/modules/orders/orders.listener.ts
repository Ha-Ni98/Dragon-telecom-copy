import { logger } from '@common/config/logger';
import { eventBus } from '@common/events/event-bus';
import type { IOrdersService } from './orders.interface';

// Subscribes to payment.clientRecorded (mirrors Order.paidAmount when the payment targets this
// order's invoice — plan §C-2). Mirrors clients/sales/billing.listener.ts's safeRun guard: a
// throw/rejection here must never propagate back into eventBus.emit()'s synchronous dispatch.
export class OrdersListener {
  constructor(private service: IOrdersService) {}

  setup(): void {
    eventBus.on('payment.clientRecorded', (payload) =>
      this.safeRun('payment.clientRecorded', () => this.service.applyClientPaymentRecorded(payload)),
    );
  }

  private safeRun(eventName: string, fn: () => Promise<void>): void {
    try {
      void fn().catch((err: unknown) => {
        logger.error({ err, event: eventName }, 'orders listener failed to record an event');
      });
    } catch (err) {
      logger.error({ err, event: eventName }, 'orders listener failed to record an event');
    }
  }
}
