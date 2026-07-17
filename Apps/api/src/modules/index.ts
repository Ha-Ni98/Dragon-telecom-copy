import type { Router } from 'express';
import { router as identityRouter } from './identity/identity.routes';
import { router as platformRouter } from './platform/platform.routes';

// Aggregates every module router into one mount call at app.ts's extension point, so app.ts
// stays stable as later modules (catalog, clients, ...) are added here.
export const registerModules = (apiRouter: Router): void => {
  apiRouter.use(identityRouter);
  apiRouter.use(platformRouter);
};
