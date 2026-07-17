export type InventoryEvents = {
  'inventory.stockChanged': { productId: string; onHand: number; reserved: number };
  'inventory.lowStock': { productId: string; available: number; threshold: number };
  'inventory.adjusted': { reference: string; description: string };
};
