import type { Request, Response } from 'express';
import type { DisputeMessage } from '../generated/prisma/client';
import { BadRequestError } from '../lib';
import { parseIntParam, buildAttachment } from '../utils';
import { postMessageSchema, type PostMessageInput } from '../validation';
import type { MessageAttachment } from '../types';
import { disputeService } from '../services';

export async function getMessages (req: Request, res: Response): Promise<void> {
  const taskId: number | null = parseIntParam(req.params.id);
  if (taskId === null) {
    throw new BadRequestError('Invalid task id');
  }

  const messages: DisputeMessage[] = await disputeService.getDisputeMessages(taskId);
  res.json(messages);
}

export async function postMessage (req: Request, res: Response): Promise<void> {
  const taskId: number | null = parseIntParam(req.params.id);
  if (taskId === null) {
    throw new BadRequestError('Invalid task id');
  }

  const data: PostMessageInput = postMessageSchema.parse(req.body);
  const attachment: MessageAttachment = buildAttachment(req.file);

  const msg: DisputeMessage = await disputeService.postDisputeMessage(taskId, data, attachment);
  res.status(201).json(msg);
}
