import type { ReceiptDto, SaleDto } from "@dragon-telecom/contract";

// A reprint from the sales list has to rebuild the receipt from the SaleDto, because ReceiptDto is
// only ever produced by the confirm call — there is no GET that returns one for an existing sale.
//
// The arithmetic here is not invented: it mirrors the API's own SalesMapper.toReceiptDto
// (Apps/api/src/modules/sales/sales.mapper.ts) field for field, including the two details that are
// easy to get wrong —
//   * `grandTotal` is NOT a stored column. It is `total + previousCredit`: what the client would
//     owe in total if they paid nothing today (this sale plus whatever they already owed).
//   * `previousCredit`/`newCredit` are optional on SaleDto (nullable columns) and default to 0,
//     exactly as the mapper coerces them.
// A reprinted receipt that disagreed with the original on the credit block would be worse than no
// reprint at all, which is why this follows the server rather than re-deriving the rules.
export function saleToReceipt(sale: SaleDto): ReceiptDto {
  const total = sale.totalAmount;
  const previousCredit = sale.previousCredit ?? 0;

  return {
    reference: sale.reference,
    lines: sale.lines.map((line) => ({
      productName: line.productName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      ...(line.serialNumbers != null ? { serialNumbers: line.serialNumbers } : {}),
    })),
    subtotal: sale.subtotal,
    discountAmount: sale.discountAmount,
    total,
    previousCredit,
    grandTotal: total + previousCredit,
    totalPaid: sale.paidAmount,
    newCredit: sale.newCredit ?? 0,
    ...(sale.posClientName != null ? { posClientName: sale.posClientName } : {}),
    staffName: sale.staffName,
    ...(sale.soldAt != null ? { soldAt: sale.soldAt } : {}),
  };
}
