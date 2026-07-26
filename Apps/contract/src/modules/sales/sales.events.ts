// snapshotLines' exact fields aren't spelled out beyond the name; modelled as the minimal
// line data billing needs to build an invoice line (label/qty/unitPrice/lineTotal).
// return.created's creditEffect isn't typed in the spec ("credit ↓/↑ per snapshot"
// elsewhere describes a signed delta) — kept as an optional number. Its MEANING changed in S5
// (D7): it is no longer the raw negated refund amount, but the net credit delta actually applied
// to the client's account — 0 on a partial return (the refund's credit rise is offset by the
// document charge's matching fall), and the sale's own reversed credit delta on a full one.
// No `origin` member (S1): with repairs no longer producing a Sale row at all (D9), every
// sale.confirmed emission is POS by construction — the field carried no information.
export type SalesEvents = {
  'sale.confirmed': {
    saleId: string;
    posClientId?: string;
    totalAmount: number;
    paidAmount: number;
    previousCredit?: number;
    newCredit?: number;
    snapshotLines: {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
  };
  'return.created': {
    returnId: string;
    saleId: string;
    refundAmount: number;
    posClientId?: string;
    creditEffect?: number;
  };
};
