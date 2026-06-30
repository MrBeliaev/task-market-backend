import type { Request, Response } from 'express';
import type { TaskMessage } from '../generated/prisma/client';
import { BadRequestError } from '../lib';
import { parseIntParam, buildAttachment } from '../utils';
import { postMessageSchema, type PostMessageInput } from '../validation';
import type { MessageAttachment } from '../types';
import { chatService } from '../services';

export async function getMessages (req: Request, res: Response): Promise<void> {
  const taskId: number | null = parseIntParam(req.params.id);
  if (taskId === null) {
    throw new BadRequestError('Invalid task id');
  }

  const messages: TaskMessage[] = await chatService.getMessages(taskId);
  res.json(messages);
}

/** Only the task's client or executor may post. Signature required. */
export async function postMessage (req: Request, res: Response): Promise<void> {
  const taskId: number | null = parseIntParam(req.params.id);
  if (taskId === null) {
    throw new BadRequestError('Invalid task id');
  }

  const data: PostMessageInput = postMessageSchema.parse(req.body);
  const attachment: MessageAttachment = buildAttachment(req.file);

  const msg: TaskMessage = await chatService.postMessage(taskId, data, attachment);
  res.status(201).json(msg);
}
