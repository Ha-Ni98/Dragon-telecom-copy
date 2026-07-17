import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './env';
import { logger } from './common/config/logger';
import { sendSuccess } from './common/http/response';
import { globalErrorHandler } from './common/middlewares/error.middleware';

export const app = express();

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' });
});

const apiRouter = express.Router();
// EXTENSION POINT (modules): mount each module's router here, e.g.
//   apiRouter.use(IDENTITY_ROUTES.LOGIN, identityRouter);
// Route paths come from @dragon-telecom/contract *_ROUTES constants only — no string literals.
app.use(env.API_PREFIX, apiRouter);

app.use(globalErrorHandler);
