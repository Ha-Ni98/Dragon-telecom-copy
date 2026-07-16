import { Router } from 'express';
import { AUTH_ROUTES, DELIVERY_COMPANY_ROUTES } from '@your-app/contract';
import { authRouter } from './auth/auth.routes';
import { deliveryCompanyRouter } from './delivery-company/delivery-company.routes';

export const moduleRouter = Router();

moduleRouter.use(AUTH_ROUTES.BASE, authRouter);
moduleRouter.use(DELIVERY_COMPANY_ROUTES.BASE, deliveryCompanyRouter);
// EXTENSION POINT (modules): mount each new module's router here.
