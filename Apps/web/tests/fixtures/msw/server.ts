import { setupServer } from "msw/node";
import type { RequestHandler } from "msw";
import { authHandlers } from "./auth.handlers";
import { catalogHandlers } from "./catalog.handlers";
import { clientsHandlers } from "./clients.handlers";
import { platformHandlers } from "./platform.handlers";
import { ordersHandlers } from "./orders.handlers";

// EXTENSION POINT (modules): append each new domain's handlers array here.
const handlers: RequestHandler[] = [
  ...authHandlers,
  ...catalogHandlers,
  ...clientsHandlers,
  ...platformHandlers,
  ...ordersHandlers,
];

export const server = setupServer(...handlers);
