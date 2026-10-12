// snapshotLines' exact fields aren't spelled out beyond the name; modelled as the minimal
// line data billing needs to build an invoice line (label/qty/unitPrice/lineTotal).
// return.created's creditEffect isn't typed in the spec ("credit ↓/↑ per snapshot"
// elsewhere describes a signed delta) — kept as an optional number. It is the net credit delta
// actually applied to the client's account. Since S32 that is Σ(refundAmount − linePrice) over
// the returned lines (negative when less cash came back than the goods were worth); the S5/D7
// partial/full rule is gone. `refundAmount` is the cash handed back.
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
