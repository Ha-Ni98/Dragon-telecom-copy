import { logger } from '@common/config/logger';
import { eventBus } from '@common/events/event-bus';
import type { IBillingService } from './billing.interface';

// Subscribes to sale.confirmed/order.confirmed (issues an invoice) — plan §II.2. payment.
// clientRecorded's paidAmount/status recompute moved into createClientPayment's own
// transaction (credit-serialization fix, plan §C5); this listener no longer subscribes to it.
// Mirrors clients/purchasing/sales.listener.ts's safeRun guard: a throw/rejection here must
// never propagate back into eventBus.emit()'s synchronous dispatch.
export class BillingListener {
  constructor(private service: IBillingService) {}

  setup(): void {
    eventBus.on('sale.confirmed', (payload) => this.safeRun('sale.confirmed', () => this.service.issueFromSale(payload)));
    eventBus.on('order.confirmed', (payload) => this.safeRun('order.confirmed', () => this.service.issueFromOrder(payload)));
  }

  private safeRun(eventName: string, fn: () => Promise<void>): void {
    try {
      void fn().catch((err: unknown) => {
        logger.error({ err, event: eventName }, 'billing listener failed to record an event');
      });
    } catch (err) {
      logger.error({ err, event: eventName }, 'billing listener failed to record an event');
    }
  }
}
