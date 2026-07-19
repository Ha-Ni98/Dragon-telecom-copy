import { EventEmitter } from 'node:events';
import type {
  IdentityEvents,
  CatalogEvents,
  ClientsEvents,
  InventoryEvents,
  PlatformEvents,
  PurchasingEvents,
  SalesEvents,
  OrdersEvents,
  RepairsEvents,
  BillingEvents,
} from '@dragon-telecom/contract';

// observability and statistics export no events — every other module is included.
type AppEvents = IdentityEvents &
  CatalogEvents &
  ClientsEvents &
  InventoryEvents &
  PlatformEvents &
  PurchasingEvents &
  SalesEvents &
  OrdersEvents &
  RepairsEvents &
  BillingEvents;

class TypedBus {
  private emitter = new EventEmitter();

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    this.emitter.emit(event as string, payload);
  }

  on<K extends keyof AppEvents>(event: K, handler: (payload: AppEvents[K]) => void): void {
    this.emitter.on(event as string, handler);
  }
}

export const eventBus = new TypedBus();
