import { keccak256, toUtf8Bytes } from 'ethers';
import type {
  Prisma,
  Task,
  Application,
  Comment,
} from '../generated/prisma/client';
import {
  prisma,
  isPrismaError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from '../lib';
import type {
  CreateTaskInput,
  UpdateTaskMetadataInput,
  ApplyToTaskInput,
  AddCommentInput,
  QueryTasksInput,
} from '../validation';
import type { StatsData, PaginatedTasks, TaskWithRelations } from '../types';
import { verifySignature } from './signature.service';

// In-memory stats cache (30 s TTL).
let statsCache: { data: StatsData; expiry: number } | null = null;
const STATS_TTL_MS: number = 30_000;

const TASK_RELATIONS: Prisma.TaskInclude = {
  applications: { orderBy: { createdAt: 'desc' as const } },
  comments: { orderBy: { createdAt: 'asc'  as const } },
};

export async function getStats (chainId: number | null): Promise<StatsData> {
  const now: number = Date.now();
  if (statsCache && statsCache.expiry > now) {
    return statsCache.data;
  }

  const chainFilter: Prisma.TaskWhereInput = chainId ? { chainId } : {};

  const [statusCounts, tvlResult] = await Promise.all([
    prisma.task.groupBy({ by: ['status'], where: chainFilter, _count: { id: true } }),
    chainId
      ? prisma.$queryRaw<[{ tvl: string | null }]>`
          SELECT CAST(SUM(CAST(reward AS NUMERIC)) AS TEXT) AS tvl
          FROM tasks
          WHERE chain_id = ${chainId}
            AND status NOT IN ('COMPLETED', 'CANCELLED')
        `
      : prisma.$queryRaw<[{ tvl: string | null }]>`
          SELECT CAST(SUM(CAST(reward AS NUMERIC)) AS TEXT) AS tvl
          FROM tasks
          WHERE status NOT IN ('COMPLETED', 'CANCELLED')
        `,
  ]);

  const statusBreakdown: { [k: string]: number } = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count.id]),
  );
  const data: StatsData = {
    chainId: chainId ?? null,
    totalTasks: Object.values(statusBreakdown).reduce((a, b) => a + b, 0),
    statusBreakdown,
    totalValueLockedWei: tvlResult[0]?.tvl ?? '0',
  };

  statsCache = { data, expiry: now + STATS_TTL_MS };
  return data;
}

export async function getTaskByChainId (onChainId: number, chainId: number): Promise<TaskWithRelations> {
  const task: TaskWithRelations | null = await prisma.task.findUnique({
    where: { onChainId_chainId: { onChainId, chainId } },
    include: TASK_RELATIONS,
  });
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  return task;
}

export async function getTaskById (id: number): Promise<TaskWithRelations> {
  const task: TaskWithRelations | null = await prisma.task.findUnique({
    where: { id },
    include: TASK_RELATIONS,
  });
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  return task;
}

export async function listTasks (query: QueryTasksInput): Promise<PaginatedTasks> {
  const { page, limit, chainId, ...filters } = query;
  const skip: number = (page - 1) * limit;

  const where: Prisma.TaskWhereInput = {};
  if (chainId)                {
    where.chainId  = chainId;
  }

  if (filters.status)         {
    where.status   = filters.status;
  }

  if (filters.category)       {
    where.category = filters.category;
  }

  if (filters.client)         {
    where.client   = filters.client.toLowerCase();
  }

  if (filters.executor)       {
    where.executor = filters.executor.toLowerCase();
  }

  if (filters.excludeClient)  {
    where.client   = { not: filters.excludeClient.toLowerCase() };
  }

  const deadlineFilter: { gt?: Date; lt?: Date } = {};
  if (filters.deadlineAfter)  {
    deadlineFilter.gt = new Date(filters.deadlineAfter);
  }

  if (filters.deadlineBefore) {
    deadlineFilter.lt = new Date(filters.deadlineBefore);
  }

  if (deadlineFilter.gt ?? deadlineFilter.lt) {
    where.deadline = deadlineFilter;
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true, comments: true } } },
    }),
    prisma.task.count({ where }),
  ]);

  return {
    tasks,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function createOrUpdateTask (data: CreateTaskInput): Promise<Task> {
  // Verify that the submitted metadata fields actually produce the metadataHash
  // that was committed on-chain and signed. The frontend serialises fields in
  // this exact key order; referenceLink/category default to '' when empty.
  const canonical: string = JSON.stringify({
    title: data.title,
    description: data.description,
    contactInfo: data.contactInfo,
    referenceLink: data.referenceLink ?? '',
    category: data.category ?? '',
    skills: data.skills ?? [],
  });
  const computedHash: string = keccak256(toUtf8Bytes(canonical));
  if (computedHash !== data.metadataHash) {
    throw new BadRequestError('Metadata does not match the on-chain hash');
  }

  // chainId + metadataHash binds the signature to exact content on a specific chain.
  const message: string = `create-task:${data.chainId}:${data.metadataHash}`;
  if (!verifySignature(data.client, message, data.signature)) {
    throw new UnauthorizedError('Invalid signature');
  }

  const { signature: _sig, ...fields } = data;

  return prisma.task.upsert({
    where: { onChainId_chainId: { onChainId: fields.onChainId, chainId: fields.chainId } },
    create: {
      onChainId: fields.onChainId,
      chainId: fields.chainId,
      client: fields.client.toLowerCase(),
      reward: fields.reward,
      deadline: new Date(fields.deadline),
      metadataHash: fields.metadataHash,
      title: fields.title,
      description: fields.description,
      contactInfo: fields.contactInfo,
      referenceLink: fields.referenceLink,
      category: fields.category,
      skills: fields.skills ?? [],
      status: 'OPEN',
    },
    update: {
      title: fields.title,
      description: fields.description,
      contactInfo: fields.contactInfo,
      referenceLink: fields.referenceLink,
      category: fields.category,
      skills: fields.skills ?? [],
    },
  });
}

export async function updateTaskMetadata (id: number, data: UpdateTaskMetadataInput): Promise<Task> {
  const { address, signature: sig, ...updateFields } = data;

  const message: string = `update-task:${id}:${address.toLowerCase()}`;
  if (!verifySignature(address, message, sig)) {
    throw new UnauthorizedError('Invalid signature');
  }

  const existing: Task | null = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Task not found');
  }

  if (existing.client !== address.toLowerCase()) {
    throw new ForbiddenError('Not authorized');
  }

  return prisma.task.update({ where: { id }, data: updateFields });
}

export async function applyToTask (taskId: number, data: ApplyToTaskInput): Promise<Application> {
  const message: string = `apply:${taskId}:${data.message}`;
  if (!verifySignature(data.applicant, message, data.signature)) {
    throw new UnauthorizedError('Invalid signature');
  }

  const task: Task | null = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  if (task.status !== 'OPEN') {
    throw new BadRequestError('Task is not open for applications');
  }

  if (task.client === data.applicant.toLowerCase()) {
    throw new BadRequestError('Task creator cannot apply to their own task');
  }

  try {
    return await prisma.application.create({
      data: { taskId, applicant: data.applicant.toLowerCase(), message: data.message },
    });
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      throw new ConflictError('Already applied to this task');
    }

    throw error;
  }
}

export async function listApplications (taskId: number): Promise<Application[]> {
  return prisma.application.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addComment (taskId: number, data: AddCommentInput): Promise<Comment> {
  const message: string = `comment:${taskId}:${data.content}`;
  if (!verifySignature(data.author, message, data.signature)) {
    throw new UnauthorizedError('Invalid signature');
  }

  return prisma.comment.create({
    data: { taskId, author: data.author.toLowerCase(), content: data.content },
  });
}
