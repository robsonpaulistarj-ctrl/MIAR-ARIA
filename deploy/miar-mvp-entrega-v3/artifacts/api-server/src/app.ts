import express, { type Express } from "express";
import cookieParser from 'cookie-parser';
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const configuredOrigins = process.env.WEB_ORIGIN
  ? process.env.WEB_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];
if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
  throw new Error('WEB_ORIGIN must be configured in production.');
}
const allowedOrigins = configuredOrigins.length ? configuredOrigins : true;

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use('/api', router);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
    && typeof error.statusCode === 'number'
    ? error.statusCode
    : 500;
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  logger.error({ err: error, statusCode }, 'Request failed');
  response.status(statusCode).json({ error: message });
});

export default app;
