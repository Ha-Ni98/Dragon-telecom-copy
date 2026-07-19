import { logger } from '@common/config/logger';
import { eventBus } from '@common/events/event-bus';
import type { IClientsService } from './clients.interface';

// Subscribes to this module's own post-commit `client.approved` — materializes the linked
// PosClient (plan §I.4). This is the only subscription left: sale.confirmed/return.created
// moved to sales' own transaction (C3), order.confirmed to orders' own (C4), and
// payment.clientRecorded to billing's own (C5) — all via the injected credit port
// (credit-serialization fix, plan §C2 onward). No money-cache handler is subscribed here
// anymore; every PosClient cache write now lives inside the writer's own transaction.
export class ClientsListener {
  constructor(private service: IClientsService) {}

  setup(): void {
    eventBus.on('client.approved', (payload) =>
      this.safeRun('client.approved', () =>
        this.service.materializePosClientForApprovedClient(payload.clientId, payload.posClientSeed),
      ),
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
