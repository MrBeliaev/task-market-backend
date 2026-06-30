import express, { type Express } from 'express';
import request from 'supertest';
import type * as superagent from 'superagent';
import { ZodError } from 'zod';
import type { Task } from '../generated/prisma/client';
import * as taskService from '../services/task.service';
import { AppError, getErrorMessage } from '../lib/errors';
import type { CreateTaskInput } from '../validation';
import type { PaginatedTasks, TaskWithRelations } from '../types';
import taskRoutes from './task.routes';

jest.mock('../services/task.service');

const taskServiceMock: jest.MockedObjectDeep<typeof taskService> = jest.mocked(taskService);

function buildApp () {
  const app: Express = express();
  app.use(express.json());
  app.use('/api/tasks', taskRoutes);
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

describe('task routes', () => {
  const app: Express = buildApp();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('GET /api/tasks/:id returns the task as JSON', async () => {
    taskServiceMock.getTaskById.mockResolvedValue({ id: 1 } as unknown as TaskWithRelations);

    const res: superagent.Response = await request(app).get('/api/tasks/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1 });
  });

  it('GET /api/tasks/:id returns 400 for a non-numeric id', async () => {
    const res: superagent.Response = await request(app).get('/api/tasks/not-a-number');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid task id');
    expect(taskServiceMock.getTaskById).not.toHaveBeenCalled();
  });

  it('GET /api/tasks/:id returns 404 when the service reports the task is missing', async () => {
    const { NotFoundError } = jest.requireActual('../lib/errors');
    taskServiceMock.getTaskById.mockRejectedValue(new NotFoundError('Task not found'));

    const res: superagent.Response = await request(app).get('/api/tasks/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  it('POST /api/tasks returns 400 from Zod validation before reaching the service', async () => {
    const res: superagent.Response = await request(app).post('/api/tasks').send({});

    expect(res.status).toBe(400);
    expect(taskServiceMock.createOrUpdateTask).not.toHaveBeenCalled();
  });

  it('POST /api/tasks creates a task on valid input', async () => {
    const payload: CreateTaskInput = {
      onChainId: 1,
      chainId: 1,
      client: '0x000000000000000000000000000000000000dEaD',
      signature: '0xsig',
      reward: '1000',
      deadline: new Date().toISOString(),
      metadataHash: '0xhash',
      title: 'A valid task title',
      description: 'A description that is long enough to pass validation.',
      contactInfo: 'telegram:foo',
    };
    taskServiceMock.createOrUpdateTask.mockResolvedValue({ id: 1, ...payload } as unknown as Task);

    const res: superagent.Response = await request(app).post('/api/tasks').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(taskServiceMock.createOrUpdateTask).toHaveBeenCalledTimes(1);
  });

  it('GET /api/tasks paginates via the service and returns its result verbatim', async () => {
    const payload: PaginatedTasks = { tasks: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    taskServiceMock.listTasks.mockResolvedValue(payload);

    const res: superagent.Response = await request(app).get('/api/tasks?page=1&limit=20');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(payload);
  });
});
