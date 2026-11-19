import { logger } from '@common/config/logger';
import { eventBus } from '@common/events/event-bus';
import type { AuditEntry, IObservabilityService } from './observability.interface';

// The audit/activity core — subscribes to every event the spec's listen-list names (plan §0.1,
// 34 keys total across 10 emitting modules) and renders one narrated AuditLog row per event, plus
// one StaffSearchLog row for product.searched. Narration is built from the payload only — no
// cross-table reads, keeping every handler decoupled and replay-stable.
export class ObservabilityListener {
  constructor(private service: IObservabilityService) {}

  setup(): void {
    this.registerIdentity();
    this.registerClients();
    this.registerCatalog();
    this.registerInventory();
    this.registerPlatform();
    this.registerPurchasing();
    this.registerSales();
    this.registerOrders();
    this.registerRepairs();
    this.registerBilling();
  }

  private registerIdentity(): void {
    eventBus.on('auth.loggedIn', (payload) =>
      this.handle('auth.loggedIn', payload, (p) => ({
        actionType: 'auth.loggedIn',
        entityType: 'User',
        entityId: p.userId,
        description: `Logged in (${p.authType})`,
        userId: p.userId,
        ...(p.ipAddress != null ? { ipAddress: p.ipAddress } : {}),
        // Two logins by the same user narrate identically — the dedupe check would otherwise
        // silently drop the second, entirely legitimate occurrence (Sprint O2 finding).
        alwaysAppend: true,
      })),
    );

    eventBus.on('user.created', (payload) =>
      this.handle('user.created', payload, (p) => ({
        actionType: 'user.created',
        entityType: 'User',
        entityId: p.user.id,
        description: `User ${p.user.username} created (${p.user.type})`,
      })),
    );

    eventBus.on('user.updated', (payload) =>
      this.handle('user.updated', payload, (p) => ({
        actionType: 'user.updated',
        entityType: 'User',
        entityId: p.user.id,
        description: `User ${p.user.username} updated (${p.user.type})`,
      })),
    );

    eventBus.on('user.roleChanged', (payload) =>
      this.handle('user.roleChanged', payload, (p) => ({
        actionType: 'user.roleChanged',
        entityType: 'User',
        entityId: p.userId,
        description: `Roles changed → [${p.roleIds.join(', ')}]`,
      })),
    );
  }

  private registerClients(): void {
    eventBus.on('client.registered', (payload) =>
      this.handle('client.registered', payload, (p) => ({
        actionType: 'client.registered',
        entityType: 'Client',
        entityId: p.clientId,
        description: 'Registered',
      })),
    );

    eventBus.on('client.approved', (payload) =>
      this.handle('client.approved', payload, (p) => ({
        actionType: 'client.approved',
        entityType: 'Client',
        entityId: p.clientId,
        description: 'Approved',
      })),
    );

    eventBus.on('client.rejected', (payload) =>
      this.handle('client.rejected', payload, (p) => ({
        actionType: 'client.rejected',
        entityType: 'Client',
        entityId: p.clientId,
        description: p.reason ? `Rejected: ${p.reason}` : 'Rejected',
      })),
    );

    eventBus.on('client.passwordReset', (payload) =>
      this.handle('client.passwordReset', payload, (p) => ({
        actionType: 'client.passwordReset',
        entityType: 'Client',
        entityId: p.clientId,
        description: 'Password reset',
      })),
    );

    eventBus.on('posClient.creditChanged', (payload) =>
      this.handle('posClient.creditChanged', payload, (p) => ({
        actionType: 'posClient.creditChanged',
        entityType: 'PosClient',
        entityId: p.posClientId,
        description: `Credit ${p.previousCredit} → ${p.newCredit} (${p.cause})`,
      })),
    );
  }

  private registerCatalog(): void {
    eventBus.on('product.created', (payload) =>
      this.handle('product.created', payload, (p) => ({
        actionType: 'product.created',
        entityType: 'Product',
        entityId: p.productId,
        description: `Product ${p.name} created`,
      })),
    );

    eventBus.on('product.repriced', (payload) =>
      this.handle('product.repriced', payload, (p) => ({
        actionType: 'product.repriced',
        entityType: 'Product',
        entityId: p.productId,
        description: `Product ${p.name} repriced`,
      })),
    );

    eventBus.on('taxonomy.changed', (payload) =>
      this.handle('taxonomy.changed', payload, (p) => ({
        actionType: 'taxonomy.changed',
        entityType: p.entityType,
        entityId: p.entityId,
        description: p.description,
      })),
    );

    eventBus.on('clientCategory.changed', (payload) =>
      this.handle('clientCategory.changed', payload, (p) => ({
        actionType: 'clientCategory.changed',
        entityType: 'ClientCategory',
        entityId: p.categoryId,
        description: p.description,
      })),
    );

    // Activity, not audit — writes one StaffSearchLog row directly, no AuditEntry involved.
    eventBus.on('product.searched', (payload) => {
      this.safeRun('product.searched', () => this.service.recordProductSearched(payload));
    });
  }

  private registerInventory(): void {
    // Only inventory.adjusted is subscribed — stockChanged/lowStock are not audited (plan §0.1).
    eventBus.on('inventory.adjusted', (payload) =>
      this.handle('inventory.adjusted', payload, (p) => ({
        actionType: 'inventory.adjusted',
        entityType: 'StockAdjustment',
        entityId: p.reference,
        description: p.description,
      })),
    );
  }

  private registerPlatform(): void {
    eventBus.on('settings.changed', (payload) =>
      this.handle('settings.changed', payload, (p) => ({
        actionType: 'settings.changed',
        entityType: 'Settings',
        entityId: 'settings',
        description: p.description,
      })),
    );

    eventBus.on('heroSlides.changed', (payload) =>
      this.handle('heroSlides.changed', payload, (p) => ({
        actionType: 'heroSlides.changed',
        entityType: 'HeroSlide',
        entityId: 'hero-slides',
        description: p.description,
      })),
    );

    eventBus.on('deliveryFees.changed', (payload) =>
      this.handle('deliveryFees.changed', payload, (p) => ({
        actionType: 'deliveryFees.changed',
        entityType: 'DeliveryFee',
        entityId: 'fees',
        description: p.description,
      })),
    );
  }

  private registerPurchasing(): void {
    eventBus.on('supplierInvoice.confirmed', (payload) =>
      this.handle('supplierInvoice.confirmed', payload, (p) => ({
        actionType: 'supplierInvoice.confirmed',
        entityType: 'SupplierInvoice',
        entityId: p.invoiceId,
        description: `Confirmed: total ${p.totalAmount}, credit ${p.previousCredit} → ${p.newCredit}`,
      })),
    );

    eventBus.on('supplierInvoice.cancelled', (payload) =>
      this.handle('supplierInvoice.cancelled', payload, (p) => ({
        actionType: 'supplierInvoice.cancelled',
        entityType: 'SupplierInvoice',
        entityId: p.invoiceId,
        description: p.reason ? `Cancelled: ${p.reason}` : 'Cancelled',
      })),
    );

    eventBus.on('payment.supplierRecorded', (payload) =>
      this.handle('payment.supplierRecorded', payload, (p) => ({
        actionType: 'payment.supplierRecorded',
        entityType: 'SupplierPayment',
        entityId: p.paymentId,
        description: `Amount ${p.amount}: credit ${p.previousCredit} → ${p.newCredit}`,
      })),
    );

    eventBus.on('supplier.creditChanged', (payload) =>
      this.handle('supplier.creditChanged', payload, (p) => ({
        actionType: 'supplier.creditChanged',
        entityType: 'Supplier',
        entityId: p.supplierId,
        description: `Credit ${p.previousCredit} → ${p.newCredit} (${p.cause})`,
      })),
    );
  }

  private registerSales(): void {
    eventBus.on('sale.confirmed', (payload) =>
      this.handle('sale.confirmed', payload, (p) => ({
        actionType: 'sale.confirmed',
        entityType: 'Sale',
        entityId: p.saleId,
        description:
          p.previousCredit != null && p.newCredit != null
            ? `Total ${p.totalAmount}, credit ${p.previousCredit} → ${p.newCredit}`
            : `Total ${p.totalAmount}`,
      })),
    );

    eventBus.on('return.created', (payload) =>
      this.handle('return.created', payload, (p) => ({
        actionType: 'return.created',
        entityType: 'Return',
        entityId: p.returnId,
        description: `Refund ${p.refundAmount} for sale ${p.saleId}`,
      })),
    );
  }

  private registerOrders(): void {
    // S10 — order.confirmed no longer carries totals/lines (D2/D3: nothing accrues at
    // confirmation any more); the money narration for a completed order comes through
    // invoice.issued/payment.clientRecorded, exactly like a POS sale.
    eventBus.on('order.confirmed', (payload) =>
      this.handle('order.confirmed', payload, (p) => ({
        actionType: 'order.confirmed',
        entityType: 'Order',
        entityId: p.orderId,
        description: 'Confirmed',
      })),
    );

    eventBus.on('order.placed', (payload) =>
      this.handle('order.placed', payload, (p) => ({
        actionType: 'order.placed',
        entityType: 'Order',
        entityId: p.orderId,
        description: 'Placed',
      })),
    );

    eventBus.on('order.statusChanged', (payload) =>
      this.handle('order.statusChanged', payload, (p) => ({
        actionType: 'order.statusChanged',
        entityType: 'Order',
        entityId: p.orderId,
        description: `Status ${p.fromStatus} → ${p.toStatus}`,
      })),
    );

    // D4 (S10) — byClient distinguishes a client's own cancellation from an admin one.
    eventBus.on('order.cancelled', (payload) =>
      this.handle('order.cancelled', payload, (p) => ({
        actionType: 'order.cancelled',
        entityType: 'Order',
        entityId: p.orderId,
        description: `${p.byClient ? 'Cancelled by client' : 'Cancelled'}${p.reason ? `: ${p.reason}` : ''}`,
      })),
    );

    eventBus.on('order.returned', (payload) =>
      this.handle('order.returned', payload, (p) => ({
        actionType: 'order.returned',
        entityType: 'Order',
        entityId: p.orderId,
        description: `Returned: refund ${p.refundAmount}`,
      })),
    );
  }

  private registerRepairs(): void {
    eventBus.on('repair.pickedUp', (payload) =>
      this.handle('repair.pickedUp', payload, (p) => ({
        actionType: 'repair.pickedUp',
        entityType: 'Repair',
        entityId: p.repairId,
        description: `Picked up: total ${p.totalAmount}`,
      })),
    );

    eventBus.on('repair.statusChanged', (payload) =>
      this.handle('repair.statusChanged', payload, (p) => ({
        actionType: 'repair.statusChanged',
        entityType: 'Repair',
        entityId: p.repairId,
        description: `Status ${p.fromStatus} → ${p.toStatus}`,
      })),
    );

    eventBus.on('repair.cancelled', (payload) =>
      this.handle('repair.cancelled', payload, (p) => ({
        actionType: 'repair.cancelled',
        entityType: 'Repair',
        entityId: p.repairId,
        description: p.reason ? `Cancelled: ${p.reason}` : 'Cancelled',
      })),
    );

    // S30 — the return document (PICKED_UP → RETURNED).
    eventBus.on('repair.returned', (payload) =>
      this.handle('repair.returned', payload, (p) => ({
        actionType: 'repair.returned',
        entityType: 'Repair',
        entityId: p.repairId,
        description: `Returned: refund ${p.refundAmount}, ${p.restockedPartCount} part(s) restocked`,
      })),
    );
  }

  private registerBilling(): void {
    eventBus.on('invoice.issued', (payload) =>
      this.handle('invoice.issued', payload, (p) => ({
        actionType: 'invoice.issued',
        entityType: 'Invoice',
        entityId: p.invoiceNumber,
        description: `Issued from ${p.sourceType} ${p.sourceReference}`,
      })),
    );

    eventBus.on('invoice.cancelled', (payload) =>
      this.handle('invoice.cancelled', payload, (p) => ({
        actionType: 'invoice.cancelled',
        entityType: 'Invoice',
        entityId: p.invoiceNumber,
        description: p.reason ? `Cancelled: ${p.reason}` : 'Cancelled',
      })),
    );

    eventBus.on('payment.clientRecorded', (payload) =>
      this.handle('payment.clientRecorded', payload, (p) => ({
        actionType: 'payment.clientRecorded',
        entityType: 'ClientPayment',
        entityId: p.paymentId,
        description: `Amount ${p.amount}: credit ${p.previousCredit} → ${p.newCredit}`,
      })),
    );
  }

  private handle<P>(eventName: string, payload: P, build: (payload: P) => AuditEntry): void {
    this.safeRun(eventName, () => this.service.recordAuditEvent(build(payload)));
  }

  // Guards both failure modes: a synchronous throw while building the entry (e.g. a malformed
  // payload) and an async rejection from the service call — neither may ever propagate back into
  // eventBus.emit()'s synchronous dispatch.
  private safeRun(eventName: string, fn: () => Promise<void>): void {
    try {
      void fn().catch((err: unknown) => {
        logger.error({ err, event: eventName }, 'observability listener failed to record an event');
      });
    } catch (err) {
      logger.error({ err, event: eventName }, 'observability listener failed to record an event');
    }
  }
}
