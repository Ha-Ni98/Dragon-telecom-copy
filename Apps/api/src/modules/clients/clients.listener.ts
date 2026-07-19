import { logger } from '@common/config/logger';
import { eventBus } from '@common/events/event-bus';
import type { IClientsService } from './clients.interface';

// Subscribes to this module's own post-commit `client.approved` (materializes the linked
// PosClient — plan §I.4) plus the remaining cross-module cache handler not yet moved to the
// injected credit port (credit-serialization fix, plan §C2 onward — sale.confirmed/
// return.created moved to sales' own transaction in C3, order.confirmed to orders' own in C4;
// payment.clientRecorded follows in C5).
export class ClientsListener {
  constructor(private service: IClientsService) {}

  setup(): void {
    eventBus.on('client.approved', (payload) =>
      this.safeRun('client.approved', () =>
        this.service.materializePosClientForApprovedClient(payload.clientId, payload.posClientSeed),
      ),
    );

    eventBus.on('payment.clientRecorded', (payload) =>
      this.safeRun('payment.clientRecorded', () => this.service.applyClientPaymentRecorded(payload)),
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
