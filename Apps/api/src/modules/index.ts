import type { Router } from 'express';
import { router as identityRouter } from './identity/identity.routes';
import { router as platformRouter } from './platform/platform.routes';
import { router as observabilityRouter } from './observability/observability.routes';
import { router as catalogRouter } from './catalog/catalog.routes';

// Aggregates every module router into one mount call at app.ts's extension point, so app.ts
// stays stable as later modules (clients, ...) are added here.
export const registerModules = (apiRouter: Router): void => {
  apiRouter.use(identityRouter);
  apiRouter.use(platformRouter);
  apiRouter.use(observabilityRouter);
  apiRouter.use(catalogRouter);
};
