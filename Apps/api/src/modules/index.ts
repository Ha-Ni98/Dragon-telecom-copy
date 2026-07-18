import type { Router } from 'express';
import type { Prisma } from '@prisma/client';
import type { MovementType } from '@dragon-telecom/contract';
import { router as identityRouter } from './identity/identity.routes';
import { router as platformRouter } from './platform/platform.routes';
import { router as observabilityRouter } from './observability/observability.routes';
import { router as catalogRouter, catalogProductService } from './catalog/catalog.routes';
import type { IInventoryPort } from './catalog/catalog.interface';
import { router as inventoryRouter, inventoryService } from './inventory/inventory.routes';
import { router as clientsRouter } from './clients/clients.routes';
import { router as purchasingRouter } from './purchasing/purchasing.routes';
import { router as salesRouter } from './sales/sales.routes';
import { router as billingRouter } from './billing/billing.routes';

// Adapts the real FIFO engine (IInventoryService) to the shape catalog's createProduct expects
// (IInventoryPort) — object-input vs. positional args, and discards the returned movementId
// catalog has no use for. Lives here (not in either module's own folder) so neither module
// imports the other: only the aggregator is allowed to know about both (inventory plan §6, §8 #5).
const inventoryPortAdapter: IInventoryPort = {
  addLayer: (
    tx: Prisma.TransactionClient,
    input: { productId: string; quantity: number; unitCost: number; type: MovementType; staffId: string },
  ) =>
    inventoryService
      .addLayer(tx, input.productId, input.quantity, input.unitCost, input.type, {
        referenceType: 'PRODUCT',
        referenceId: input.productId,
        staffId: input.staffId,
      })
      .then(() => undefined),
};

// Aggregates every module router into one mount call at app.ts's extension point, so app.ts
// stays stable as later modules (clients, ...) are added here.
export const registerModules = (apiRouter: Router): void => {
  // Replaces catalog's InventoryPortStub with the real inventory engine, now that it exists
  // (inventory plan §6) — must run before any request is served, which module-load-time wiring
  // here guarantees.
  catalogProductService.useInventory(inventoryPortAdapter);

  apiRouter.use(identityRouter);
  apiRouter.use(platformRouter);
  apiRouter.use(observabilityRouter);
  apiRouter.use(catalogRouter);
  apiRouter.use(inventoryRouter);
  // clients.routes.ts imports identityService/catalogProductService/sequenceService directly
  // (one-directional dependency, no adapter needed here — see clients.routes.ts's own comment).
  apiRouter.use(clientsRouter);
  // purchasing.routes.ts imports sequenceService/inventoryService/catalogProductService
  // directly, same one-directional shape.
  apiRouter.use(purchasingRouter);
  // sales.routes.ts imports sequenceService/inventoryService/catalogProductService directly,
  // same one-directional shape (catalogProductService satisfies ICatalogPosPricingPort
  // structurally — set-06 Sprint 1's resolvePosPrices — no adapter needed).
  apiRouter.use(salesRouter);
  // billing.routes.ts imports sequenceService directly and constructs its own second
  // PlatformService(prisma) for IStoreSettingsPort (platform.routes.ts exports no service
  // singleton) — same one-directional shape, no adapter needed. No listener registration here:
  // billing.routes.ts wires its own BillingListener, matching every prior module; clients' and
  // observability's dormant handlers for invoice.issued/payment.clientRecorded wake automatically.
  apiRouter.use(billingRouter);
};
