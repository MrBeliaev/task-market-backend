import type { TaskMessage, Task } from '../generated/prisma/client';
import {
  prisma,
  broadcast,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from '../lib';
import type { PostMessageInput } from '../validation';
import type { MessageAttachment } from '../types';
import { verifySignature } from './signature.service';

const ACTIVE_STATUSES: Set<string> = new Set([
  'ASSIGNED',
  'IN_PROGRESS',
  'UNDER_REVIEW',
  'DISPUTED',
  'COMPLETED',
]);

export async function getMessages (taskId: number): Promise<TaskMessage[]> {
  const task: Task | null = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  return prisma.taskMessage.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
  });
}

/** Only the task's client or executor may post. Signature required. */
export async function postMessage (
  taskId: number,
  data: PostMessageInput,
  attachment: MessageAttachment,
): Promise<TaskMessage> {
  const message: string = `chat:${taskId}:${data.content}`;
  if (!verifySignature(data.sender, message, data.signature)) {
    throw new UnauthorizedError('Invalid signature');
  }

  const task: Task | null = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  if (!ACTIVE_STATUSES.has(task.status)) {
    throw new BadRequestError('Chat is only available once a task is assigned');
  }

  const senderLower: string = data.sender.toLowerCase();
  const isParticipant: boolean = task.client === senderLower || task.executor === senderLower;
  if (!isParticipant) {
    throw new ForbiddenError('Only the task client or executor may post');
  }

  const msg: TaskMessage = await prisma.taskMessage.create({
    data: { taskId, sender: senderLower, content: data.content, ...attachment },
  });

  broadcast(taskId, { type: 'message', data: msg });

  return msg;
}
