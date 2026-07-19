import { setupServer } from "msw/node";
import type { RequestHandler } from "msw";
import { authHandlers } from "./auth.handlers";

// EXTENSION POINT (modules): append each new domain's handlers array here.
const handlers: RequestHandler[] = [...authHandlers];

export const server = setupServer(...handlers);
