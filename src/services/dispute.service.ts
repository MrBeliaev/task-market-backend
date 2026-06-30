import type { DisputeMessage, Task } from '../generated/prisma/client';
import {
  prisma,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from '../lib';
import type { PostMessageInput } from '../validation';
import type { MessageAttachment } from '../types';
import { verifySignature } from './signature.service';
import { isDefaultChainAdmin } from './admin.service';

function isParticipant (task: { client: string; executor: string | null }, addr: string): boolean {
  const a: string = addr.toLowerCase();
  return task.client === a || task.executor === a;
}

export async function getDisputeMessages (taskId: number): Promise<DisputeMessage[]> {
  const task: Task | null = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  return prisma.disputeMessage.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function postDisputeMessage (
  taskId: number,
  data: PostMessageInput,
  attachment: MessageAttachment,
): Promise<DisputeMessage> {
  const message: string = `dispute:${taskId}:${data.content}`;
  if (!verifySignature(data.sender, message, data.signature)) {
    throw new UnauthorizedError('Invalid signature');
  }

  const task: Task | null = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  const senderLower: string = data.sender.toLowerCase();
  const isAdmin: boolean = await isDefaultChainAdmin(senderLower);

  if (!isAdmin && !isParticipant(task, senderLower)) {
    throw new ForbiddenError('Only task participants or admin can post');
  }

  if (task.status !== 'DISPUTED' && !isAdmin) {
    throw new BadRequestError('Dispute chat is only active when task is disputed');
  }

  return prisma.disputeMessage.create({
    data: { taskId, sender: senderLower, isAdmin, content: data.content, ...attachment },
  });
}
