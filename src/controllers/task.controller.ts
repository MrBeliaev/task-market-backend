import type { Request, Response } from 'express';
import type { Task, Application, Comment } from '../generated/prisma/client';
import { BadRequestError } from '../lib';
import { parseIntParam } from '../utils';
import {
  createTaskSchema,
  queryTasksSchema,
  updateTaskMetadataSchema,
  applyToTaskSchema,
  addCommentSchema,
  type CreateTaskInput,
  type UpdateTaskMetadataInput,
  type ApplyToTaskInput,
  type AddCommentInput,
  type QueryTasksInput,
} from '../validation';
import type { StatsData, TaskWithRelations, PaginatedTasks } from '../types';
import { taskService } from '../services';

export async function getStats (req: Request, res: Response): Promise<void> {
  const chainId: number | null = parseIntParam(req.query.chainId as string | string[] | undefined);
  const data: StatsData = await taskService.getStats(chainId);
  res.json(data);
}

export async function getTaskByChainId (req: Request, res: Response): Promise<void> {
  const onChainId: number | null = parseIntParam(req.params.onChainId);
  if (onChainId === null) {
    throw new BadRequestError('Invalid onChainId');
  }

  const chainId: number | null = parseIntParam(req.query.chainId as string | string[] | undefined);
  if (chainId === null) {
    throw new BadRequestError('chainId query param is required');
  }

  const task: TaskWithRelations = await taskService.getTaskByChainId(onChainId, chainId);
  res.json(task);
}

export async function getTaskById (req: Request, res: Response): Promise<void> {
  const id: number | null = parseIntParam(req.params.id);
  if (id === null) {
    throw new BadRequestError('Invalid task id');
  }

  const task: TaskWithRelations = await taskService.getTaskById(id);
  res.json(task);
}

export async function listTasks (req: Request, res: Response): Promise<void> {
  const query: QueryTasksInput = queryTasksSchema.parse(req.query);
  const result: PaginatedTasks = await taskService.listTasks(query);
  res.json(result);
}

export async function createTask (req: Request, res: Response): Promise<void> {
  const data: CreateTaskInput = createTaskSchema.parse(req.body);
  const task: Task = await taskService.createOrUpdateTask(data);
  res.status(201).json(task);
}

export async function updateTaskMetadata (req: Request, res: Response): Promise<void> {
  const id: number | null = parseIntParam(req.params.id);
  if (id === null) {
    throw new BadRequestError('Invalid task id');
  }

  const data: UpdateTaskMetadataInput = updateTaskMetadataSchema.parse(req.body);
  const task: Task = await taskService.updateTaskMetadata(id, data);
  res.json(task);
}

export async function applyToTask (req: Request, res: Response): Promise<void> {
  const taskId: number | null = parseIntParam(req.params.id);
  if (taskId === null) {
    throw new BadRequestError('Invalid task id');
  }

  const data: ApplyToTaskInput = applyToTaskSchema.parse(req.body);
  const application: Application = await taskService.applyToTask(taskId, data);
  res.status(201).json(application);
}

export async function listApplications (req: Request, res: Response): Promise<void> {
  const taskId: number | null = parseIntParam(req.params.id);
  if (taskId === null) {
    throw new BadRequestError('Invalid task id');
  }

  const applications: Application[] = await taskService.listApplications(taskId);
  res.json(applications);
}

export async function addComment (req: Request, res: Response): Promise<void> {
  const taskId: number | null = parseIntParam(req.params.id);
  if (taskId === null) {
    throw new BadRequestError('Invalid task id');
  }

  const data: AddCommentInput = addCommentSchema.parse(req.body);
  const comment: Comment = await taskService.addComment(taskId, data);
  res.status(201).json(comment);
}
