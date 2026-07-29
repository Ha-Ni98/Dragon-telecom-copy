import type { RepairStatus } from './repairs.enums';

// S13/D9 — parts are costed inside the PICKED_UP transaction itself (consumption now happens
// there, not at COMPLETED), so snapshotParts' costOfGoods/profit really are computed at emit
// time, unlike RepairDto.parts' optional versions elsewhere in the ticket's lifecycle.
// repair.statusChanged has no payload beyond the status pair; repair.cancelled carries an
// optional refundAmount (D6) when money already collected was returned.
export type RepairsEvents = {
  'repair.pickedUp': {
    repairId: string;
    posClientId?: string;
    invoiceNumber: string; // S13/D9 — always issued at this moment
    totalAmount: number;
    paidAmount: number; // cumulative, after this transition's own capture
    totalCost: number;
    totalProfit: number;
    snapshotParts: {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      costOfGoods: number;
      profit: number;
      lineTotal: number;
    }[];
    labourPrice: number;
  };
  'repair.statusChanged': { repairId: string; fromStatus: RepairStatus; toStatus: RepairStatus };
  'repair.cancelled': { repairId: string; reason?: string; refundAmount?: number };
};
