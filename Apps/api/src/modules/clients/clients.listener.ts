import { logger } from '@common/config/logger';
import { eventBus } from '@common/events/event-bus';
import type { IClientsService } from './clients.interface';

// Subscribes to this module's own post-commit `client.approved` (materializes the linked
// PosClient — plan §I.4) plus the four dormant cross-module cache handlers (sales/orders/
// billing aren't built yet; these stay wired but unreachable until they emit — plan §D-6).
export class ClientsListener {
  constructor(private service: IClientsService) {}

  setup(): void {
    eventBus.on('client.approved', (payload) =>
      this.safeRun('client.approved', () =>
        this.service.materializePosClientForApprovedClient(payload.clientId, payload.posClientSeed),
      ),
    );

    eventBus.on('sale.confirmed', (payload) =>
      this.safeRun('sale.confirmed', () => this.service.applySaleConfirmed(payload)),
    );
    eventBus.on('order.confirmed', (payload) =>
      this.safeRun('order.confirmed', () => this.service.applyOrderConfirmed(payload)),
    );
    eventBus.on('payment.clientRecorded', (payload) =>
      this.safeRun('payment.clientRecorded', () => this.service.applyClientPaymentRecorded(payload)),
    );
    eventBus.on('return.created', (payload) =>
      this.safeRun('return.created', () => this.service.applyReturnCreated(payload)),
    );
  }

  // Mirrors observability's own guard (plan §I.4): a throw/rejection here must never propagate
  // back into eventBus.emit()'s synchronous dispatch.
  private safeRun(eventName: string, fn: () => Promise<void>): void {
    try {
      void fn().catch((err: unknown) => {
        logger.error({ err, event: eventName }, 'clients listener failed to record an event');
      });
    } catch (err) {
      logger.error({ err, event: eventName }, 'clients listener failed to record an event');
    }
  }
}
