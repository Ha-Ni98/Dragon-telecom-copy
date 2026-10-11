import { MovementType } from "@dragon-telecom/contract";

// S30 — single source of truth for MovementType → translation keys (a short label, and the
// one-line explanation the ledger's legend prints under it), shared by the movement ledger
// table, its type filter and the legend. Record<…> so a new contract member fails to compile
// until it is labelled — before S30 the ledger printed the raw enum value, and an untranslated
// PENDING_RELEASE with no visible tie to its reservation read as a leaked reservation.
export const MOVEMENT_TYPE_LABEL_KEY: Record<MovementType, string> = {
  [MovementType.SUPPLIER_INVOICE]: "admin.inventory.movements.types.supplierInvoice",
  [MovementType.INITIAL_STOCK]: "admin.inventory.movements.types.initialStock",
  [MovementType.ADJUSTMENT_IN]: "admin.inventory.movements.types.adjustmentIn",
  [MovementType.RETURN_IN]: "admin.inventory.movements.types.returnIn",
  [MovementType.REPAIR_RETURN]: "admin.inventory.movements.types.repairReturn",
  [MovementType.SALE]: "admin.inventory.movements.types.sale",
  [MovementType.ORDER_OUT]: "admin.inventory.movements.types.orderOut",
  [MovementType.REPAIR_CONSUMPTION]: "admin.inventory.movements.types.repairConsumption",
  [MovementType.ADJUSTMENT_OUT]: "admin.inventory.movements.types.adjustmentOut",
  [MovementType.PENDING_ORDER]: "admin.inventory.movements.types.pendingOrder",
  [MovementType.PENDING_REPAIR]: "admin.inventory.movements.types.pendingRepair",
  [MovementType.PENDING_RELEASE]: "admin.inventory.movements.types.pendingRelease",
  [MovementType.REPAIR_CANCELLED]: "admin.inventory.movements.types.repairCancelled",
};

export const MOVEMENT_TYPE_HELP_KEY: Record<MovementType, string> = {
  [MovementType.SUPPLIER_INVOICE]: "admin.inventory.movements.legend.supplierInvoice",
  [MovementType.INITIAL_STOCK]: "admin.inventory.movements.legend.initialStock",
  [MovementType.ADJUSTMENT_IN]: "admin.inventory.movements.legend.adjustmentIn",
  [MovementType.RETURN_IN]: "admin.inventory.movements.legend.returnIn",
  [MovementType.REPAIR_RETURN]: "admin.inventory.movements.legend.repairReturn",
  [MovementType.SALE]: "admin.inventory.movements.legend.sale",
  [MovementType.ORDER_OUT]: "admin.inventory.movements.legend.orderOut",
  [MovementType.REPAIR_CONSUMPTION]: "admin.inventory.movements.legend.repairConsumption",
  [MovementType.ADJUSTMENT_OUT]: "admin.inventory.movements.legend.adjustmentOut",
  [MovementType.PENDING_ORDER]: "admin.inventory.movements.legend.pendingOrder",
  [MovementType.PENDING_REPAIR]: "admin.inventory.movements.legend.pendingRepair",
  [MovementType.PENDING_RELEASE]: "admin.inventory.movements.legend.pendingRelease",
  [MovementType.REPAIR_CANCELLED]: "admin.inventory.movements.legend.repairCancelled",
};
