import express, { type Express } from 'express';
import request from 'supertest';
import type * as superagent from 'superagent';
import { ZodError } from 'zod';
import type { Task } from '../generated/prisma/client';
import * as adminService from '../services/admin.service';
import * as signatureService from '../services/signature.service';
import { AppError, getErrorMessage } from '../lib/errors';
import adminRoutes from './admin.routes';

jest.mock('../services/admin.service');
jest.mock('../services/signature.service');

const adminServiceMock: jest.MockedObjectDeep<typeof adminService> = jest.mocked(adminService);
const signatureServiceMock: jest.MockedObjectDeep<typeof signatureService> = jest.mocked(signatureService);

function buildApp () {
  const app: Express = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid input' });
      return;
    }

    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }

    res.status(500).json({ error: getErrorMessage(err) });
  });
  return app;
}

const ADMIN_HEADERS: Record<string, string> = {
  'x-admin-address': '0x000000000000000000000000000000000000dead',
  'x-admin-signature': '0xsig',
  'x-admin-timestamp': String(Date.now()),
  'x-admin-chain-id': '11155111',
};

describe('admin routes', () => {
  const app: Express = buildApp();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects requests missing admin headers with 401', async () => {
    const res: superagent.Response = await request(app).get('/api/admin/tasks');

    expect(res.status).toBe(401);
    expect(adminServiceMock.listAdminTasks).not.toHaveBeenCalled();
  });

  it('rejects an invalid admin signature with 401', async () => {
    signatureServiceMock.verifySignature.mockReturnValue(false);

    const res: superagent.Response = await request(app).get('/api/admin/tasks').set(ADMIN_HEADERS);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid admin signature');
  });

  it('rejects a non-admin address with 403', async () => {
    signatureServiceMock.verifySignature.mockReturnValue(true);
    adminServiceMock.checkAdminOnChain.mockResolvedValue(false);

    const res: superagent.Response = await request(app).get('/api/admin/tasks').set(ADMIN_HEADERS);

    expect(res.status).toBe(403);
  });

  it('returns the task list for a verified admin', async () => {
    signatureServiceMock.verifySignature.mockReturnValue(true);
    adminServiceMock.checkAdminOnChain.mockResolvedValue(true);
    adminServiceMock.listAdminTasks.mockResolvedValue([{ id: 1 }] as unknown as Task[]);

    const res: superagent.Response = await request(app).get('/api/admin/tasks').set(ADMIN_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);
  });

  it('returns 503 when the on-chain admin check fails', async () => {
    signatureServiceMock.verifySignature.mockReturnValue(true);
    adminServiceMock.checkAdminOnChain.mockRejectedValue(new Error('RPC down'));

    const res: superagent.Response = await request(app).get('/api/admin/tasks').set(ADMIN_HEADERS);

    expect(res.status).toBe(503);
  });
});
