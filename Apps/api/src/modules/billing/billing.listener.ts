import { logger } from '@common/config/logger';
import { eventBus } from '@common/events/event-bus';
import type { IBillingService } from './billing.interface';

// Subscribes to order.confirmed (issues an order invoice post-commit) — plan §II.2. Sale invoices
// are now issued inside sales' own confirm transaction (S5/R2, via the injected
// IBillingIssuePort.issueInvoiceInTx), so this listener no longer subscribes to sale.confirmed.
// payment.clientRecorded's paidAmount/status recompute moved into captureClientPaymentInTx
// (credit-serialization fix, plan §C5; extracted as a shared primitive, S5); this listener never
// subscribed to it. S10 will move order issuance the same way sales' confirm now works — at which
// point this listener has nothing left to subscribe to and should be deleted outright, exactly as
// sales.listener.ts was in S1.
// Mirrors clients/purchasing/sales.listener.ts's safeRun guard: a throw/rejection here must
// never propagate back into eventBus.emit()'s synchronous dispatch.
export class BillingListener {
  constructor(private service: IBillingService) {}

  setup(): void {
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
