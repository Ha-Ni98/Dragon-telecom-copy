// Checkout-flow delivery fee lookups (which wilayas/communes Dragon Telecom currently
// delivers to, and the fee for a given address) — distinct from admin's delivery-fee table
// CRUD (services/admin-settings.service.ts) and from the static Algeria geography reference
// data (components/providers/wilaya-provider.tsx). Sub-01 scaffolding — see
// catalog.service.ts's header comment for the numeric-id/view-model scope decision this follows.

export async function getAvailableWilayas(): Promise<string[]> {
  return [];
}

export async function getCommunesForWilaya(_wilaya: string): Promise<string[]> {
  return [];
}

export async function calculateDeliveryFee(_wilaya: string, _commune: string, _mode: 'home' | 'office'): Promise<number> {
  return 0;
}
