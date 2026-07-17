import type { RepairStatus } from './repairs.enums';

// snapshotParts isn't fielded in the spec — modelled as the completed line snapshot
// (costOfGoods/profit are required here, unlike RepairDto.parts' optional versions,
// since by pickedUp time every part has been consumed and costed).
// repair.statusChanged/repair.cancelled have no payload at all in the spec.
export type RepairsEvents = {
  'repair.pickedUp': {
    repairId: string;
    posClientId?: string;
    totalAmount: number;
    paidAmount: number;
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
  'repair.cancelled': { repairId: string; reason?: string };
};
