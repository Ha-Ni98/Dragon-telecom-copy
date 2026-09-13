import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './env';
import { logger } from './common/config/logger';
import { sendSuccess } from './common/http/response';
import { globalErrorHandler } from './common/middlewares/error.middleware';
import { registerModules } from './modules';

export const app = express();

app.use(pinoHttp({ logger }));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' });
});

const apiRouter = express.Router();
// EXTENSION POINT (modules): each module's router is aggregated in src/modules/index.ts.
// Route paths come from @dragon-telecom/contract *_ROUTES constants only — no string literals.
registerModules(apiRouter);
app.use(env.API_PREFIX, apiRouter);
// S26.1 — the local /uploads static mount was removed: the Fly filesystem is ephemeral, so
// anything written to it disappears on every deploy. Every image now lives in R2 and is served
// from R2_PUBLIC_URL directly, never through this app.

app.use(globalErrorHandler);
