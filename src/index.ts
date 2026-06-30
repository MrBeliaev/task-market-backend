import { createServer, type Server } from 'http';
import { randomUUID } from 'crypto';
import express, {
  type Express,
  NextFunction,
  Request,
  Response,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { ZodError } from 'zod';
import {
  config,
  logger,
  swaggerSpec,
  UPLOAD_DIR,
  attachWebSocket,
  AppError,
  getErrorMessage,
  isPrismaError,
} from './lib';
import { seedDefaultChainFromEnv } from './lib/seed';
import {
  taskRoutes,
  chatRoutes,
  disputeRoutes,
  adminRoutes,
  chainRoutes,
} from './routes';
import { telegramService } from './services';

const app: Express = express();

// ── Security & transport ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(compression()); // gzip responses, typically 70-80% smaller for JSON

// ── Request tracing ───────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = req.headers['x-request-id'] ? String(req.headers['x-request-id']) : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Reads (GET/HEAD) get a generous budget; writes (POST/PATCH/PUT/DELETE, which
// include signed mutations and file uploads) get a much tighter one.
const WINDOW_MS: number = 15 * 60 * 1000;

app.use(
  rateLimit({
    windowMs: WINDOW_MS,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  rateLimit({
    windowMs: WINDOW_MS,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'GET' || req.method === 'HEAD',
    message: { error: 'Too many write requests, please slow down' },
  }),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/tasks', taskRoutes);
// Task chat (client ↔ executor): /api/tasks/:id/chat
app.use('/api/tasks/:id/chat', chatRoutes);
// Dispute chat is nested under tasks: /api/tasks/:id/dispute
app.use('/api/tasks/:id/dispute', disputeRoutes);
// Admin panel: /api/admin/tasks[/:id/dispute]
app.use('/api/admin', adminRoutes);
// Serve uploaded dispute attachments. Force download to prevent stored-XSS
// (browsers must not render arbitrary uploaded files inline).
app.use('/api/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    res.setHeader('Content-Disposition', 'attachment');
  },
}));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public chain registry: chainId + contractAddress for all enabled chains.
app.use('/api/chains', chainRoutes);

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── Global error handler ──────────────────────────────────────────────────────
// Catches errors thrown (or passed via next(err)) by any route handler, controller,
// service, or middleware — Express 5 auto-forwards rejected promises here.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (telegramService.isAlertable(err)) {
    telegramService.sendErrorAlert({ method: req.method, path: req.path, error: err });
  }

  logger.error({ requestId: req.requestId, method: req.method, path: req.path, err }, 'request failed');

  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid input' });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (isPrismaError(err, 'P2002')) {
    res.status(409).json({ error: 'Resource already exists' });
    return;
  }

  if (isPrismaError(err, 'P2025')) {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  const status: number =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status: unknown }).status)
      : 500;
  const httpStatus: number = isNaN(status) ? 500 : status;
  res.status(httpStatus).json({ error: getErrorMessage(err) });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const server: Server = createServer(app);
attachWebSocket(server);
server.listen(config.port, async () => {
  logger.info(`TaskMarket API running on port ${config.port}`);
  logger.info(`CORS origin: ${config.corsOrigin}`);
  logger.info(`WebSocket ready on ws://localhost:${config.port}/ws/chat/:taskId`);
  try {
    await seedDefaultChainFromEnv();
  } catch (err) {
    logger.warn({ err: getErrorMessage(err) }, 'chain_config seed skipped');
  }
});

export default app;
