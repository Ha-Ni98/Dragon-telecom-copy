import { logger } from '@common/config/logger';
import { eventBus } from '@common/events/event-bus';
import type { IPurchasingService } from './purchasing.interface';

// Subscribes to this module's own post-commit supplierInvoice.confirmed/.cancelled/
// payment.supplierRecorded (plan §II.4) — purchasing owns both the emitting side (confirm/
// cancel/payment already guard against double-firing) and the listening side, so correctness
// comes from that single-emission guarantee, not a from-scratch ledger recompute (see
// purchasing.service.ts's applySupplierInvoiceConfirmed comment). Mirrors clients.listener.ts's
// structure exactly.
export class PurchasingListener {
  constructor(private service: IPurchasingService) {}

  setup(): void {
    eventBus.on('supplierInvoice.confirmed', (payload) =>
      this.safeRun('supplierInvoice.confirmed', () => this.service.applySupplierInvoiceConfirmed(payload)),
    );
    eventBus.on('supplierInvoice.cancelled', (payload) =>
      this.safeRun('supplierInvoice.cancelled', () => this.service.applySupplierInvoiceCancelled(payload)),
    );
    eventBus.on('payment.supplierRecorded', (payload) =>
      this.safeRun('payment.supplierRecorded', () => this.service.applyPaymentSupplierRecorded(payload)),
    );
  }

  // Mirrors observability's/clients' own guard: a throw/rejection here must never propagate
  // back into eventBus.emit()'s synchronous dispatch.
  private safeRun(eventName: string, fn: () => Promise<void>): void {
    try {
      void fn().catch((err: unknown) => {
        logger.error({ err, event: eventName }, 'purchasing listener failed to record an event');
      });
    } catch (err) {
      logger.error({ err, event: eventName }, 'purchasing listener failed to record an event');
    }
  }
}
