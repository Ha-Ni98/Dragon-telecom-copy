// S36 — whose purchase history the "Products bought" tab shows. The admin client page starts from
// the web Client id; the POS-client drawer (both scopes) from the PosClient id. The API resolves
// the other identity itself, so both render the same aggregate. The scope is declared inline (it
// mirrors services/clients.service.ts's PosClientsScope) so this type file imports no service.
export type PurchaseHistoryOwner =
  { kind: "client"; id: string } | { kind: "posClient"; scope: "staff" | "admin"; id: string };
