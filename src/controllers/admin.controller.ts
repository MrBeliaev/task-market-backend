import type { Request, Response } from 'express';
import type { ChainConfig, DisputeMessage, Task } from '../generated/prisma/client';
import { BadRequestError } from '../lib';
import { parseIntParam } from '../utils';
import {
  createChainSchema,
  updateChainSchema,
  type CreateChainInput,
  type UpdateChainInput,
} from '../validation';
import { adminService } from '../services';

export async function listTasks (req: Request, res: Response): Promise<void> {
  const status: string | undefined = typeof req.query.status === 'string' ? req.query.status : undefined;
  const tasks: Task[] = await adminService.listAdminTasks(status);
  res.json(tasks);
}

export async function getTaskDispute (req: Request, res: Response): Promise<void> {
  const id: number | null = parseIntParam(req.params.id);
  if (id === null) {
    throw new BadRequestError('Invalid task id');
  }

  const result: { task: Task; messages: DisputeMessage[] } = await adminService.getTaskDispute(id);
  res.json(result);
}

export async function listChains (_req: Request, res: Response): Promise<void> {
  const chains: ChainConfig[] = await adminService.listChains();
  res.json(chains);
}

export async function createChain (req: Request, res: Response): Promise<void> {
  const data: CreateChainInput = createChainSchema.parse(req.body);
  const chain: ChainConfig = await adminService.createChain(data);
  res.status(201).json(chain);
}

export async function updateChain (req: Request, res: Response): Promise<void> {
  const chainId: number | null = parseIntParam(req.params.chainId);
  if (chainId === null) {
    throw new BadRequestError('Invalid chainId');
  }

  const data: UpdateChainInput = updateChainSchema.parse(req.body);
  const chain: ChainConfig = await adminService.updateChain(chainId, data);
  res.json(chain);
}
