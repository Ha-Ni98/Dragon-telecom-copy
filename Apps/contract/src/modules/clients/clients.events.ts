// Only client.approved and posClient.creditChanged have explicit payloads in the spec.
// client.registered / client.rejected / client.passwordReset are named without a field
// list — modelled minimally (the affected client id, plus what the route notes state).
export type ClientsEvents = {
  'client.registered': { clientId: string };
  'client.approved': {
    clientId: string;
    posClientSeed: { name: string; phone?: string; categoryId: string };
  };
  'client.rejected': { clientId: string; reason?: string };
  'client.passwordReset': { clientId: string };
  'posClient.creditChanged': {
    posClientId: string;
    previousCredit: number;
    newCredit: number;
    cause: string;
  };
};
