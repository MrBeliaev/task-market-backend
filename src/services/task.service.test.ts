import {
  Wallet,
  type HDNodeWallet,
  keccak256,
  toUtf8Bytes,
} from 'ethers';
import { mockReset, type DeepMockProxy } from 'jest-mock-extended';
import { prisma } from '../lib/db';
import {
  Prisma,
  type PrismaClient,
  type Task,
  type Application,
  type Comment,
} from '../generated/prisma/client';
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from '../lib/errors';
import type { CreateTaskInput } from '../validation';
import type { TaskWithRelations, StatsData } from '../types';
import * as taskService from './task.service';

jest.mock('../lib/db');

const prismaMock: DeepMockProxy<PrismaClient> = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});

const VALID_TASK_FIELDS: { title: string; description: string; contactInfo: string } = {
  title: 'A valid task title',
  description: 'A description that is long enough to pass validation.',
  contactInfo: 'telegram:foo',
};

// Mirrors the serialisation in CreateTask.tsx so the hash matches the fields.
function computeTestMetadataHash (fields: typeof VALID_TASK_FIELDS): string {
  const canonical: string = JSON.stringify({
    title: fields.title,
    description: fields.description,
    contactInfo: fields.contactInfo,
    referenceLink: '',
    category: '',
    skills: [],
  });
  return keccak256(toUtf8Bytes(canonical));
}

describe('getTaskById', () => {
  it('returns the task with relations when found', async () => {
    const task: TaskWithRelations = {
      id: 1, applications: [], comments: [],
    } as unknown as TaskWithRelations;
    prismaMock.task.findUnique.mockResolvedValue(task as unknown as Task);

    const result: TaskWithRelations = await taskService.getTaskById(1);

    expect(result).toBe(task);
    expect(prismaMock.task.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
  });

  it('throws NotFoundError when the task does not exist', async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);

    await expect(taskService.getTaskById(999)).rejects.toThrow(NotFoundError);
  });
});

describe('getTaskByChainId', () => {
  it('throws NotFoundError when the task does not exist for that chain', async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);

    await expect(taskService.getTaskByChainId(1, 11155111)).rejects.toThrow(NotFoundError);
  });
});

describe('getStats', () => {
  // statsCache is module-level state, so caching is asserted within a single test
  // to avoid cross-test pollution (the cache key doesn't vary by test, only by TTL).
  it('computes totals and TVL, then serves cached results within the TTL window', async () => {
    (prismaMock.task.groupBy as jest.Mock).mockResolvedValue([
      { status: 'OPEN', _count: { id: 2 } },
      { status: 'COMPLETED', _count: { id: 3 } },
    ]);
    prismaMock.$queryRaw.mockResolvedValue([{ tvl: '5000' }] as [{ tvl: string }]);

    const first: StatsData = await taskService.getStats(null);
    expect(first.totalTasks).toBe(5);
    expect(first.statusBreakdown).toEqual({ OPEN: 2, COMPLETED: 3 });
    expect(first.totalValueLockedWei).toBe('5000');

    const second: StatsData = await taskService.getStats(null);
    expect(second).toBe(first);
    expect(prismaMock.task.groupBy).toHaveBeenCalledTimes(1);
  });
});

describe('createOrUpdateTask', () => {
  it('throws BadRequestError when metadataHash does not match the fields', async () => {
    const client: HDNodeWallet = Wallet.createRandom();
    const data: CreateTaskInput = {
      onChainId: 1,
      chainId: 1,
      client: client.address,
      signature: '0xsig',
      reward: '1000',
      deadline: new Date().toISOString(),
      metadataHash: '0xdeadbeef',          // intentionally wrong hash
      ...VALID_TASK_FIELDS,
    };

    await expect(taskService.createOrUpdateTask(data)).rejects.toThrow(BadRequestError);
    expect(prismaMock.task.upsert).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when the signature does not match the client', async () => {
    const client: HDNodeWallet = Wallet.createRandom();
    const metadataHash: string = computeTestMetadataHash(VALID_TASK_FIELDS);
    const data: CreateTaskInput = {
      onChainId: 1,
      chainId: 1,
      client: client.address,
      signature: '0xbadsignature',
      reward: '1000',
      deadline: new Date().toISOString(),
      metadataHash,
      ...VALID_TASK_FIELDS,
    };

    await expect(taskService.createOrUpdateTask(data)).rejects.toThrow(UnauthorizedError);
    expect(prismaMock.task.upsert).not.toHaveBeenCalled();
  });

  it('upserts the task when the signature and hash are valid', async () => {
    const client: HDNodeWallet = Wallet.createRandom();
    const chainId: number = 11155111;
    const metadataHash: string = computeTestMetadataHash(VALID_TASK_FIELDS);
    const signature: string = await client.signMessage(`create-task:${chainId}:${metadataHash}`);

    const data: CreateTaskInput = {
      onChainId: 1,
      chainId,
      client: client.address,
      signature,
      reward: '1000',
      deadline: new Date().toISOString(),
      metadataHash,
      ...VALID_TASK_FIELDS,
    };

    prismaMock.task.upsert.mockResolvedValue({ id: 1 } as unknown as Task);

    const result: Task = await taskService.createOrUpdateTask(data);

    expect(result).toEqual({ id: 1 });
    expect(prismaMock.task.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('updateTaskMetadata', () => {
  it('throws NotFoundError when the task does not exist', async () => {
    const signer: HDNodeWallet = Wallet.createRandom();
    const id: number = 1;
    const signature: string = await signer.signMessage(`update-task:${id}:${signer.address.toLowerCase()}`);
    prismaMock.task.findUnique.mockResolvedValue(null);

    await expect(
      taskService.updateTaskMetadata(id, { address: signer.address, signature }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when the signer is not the tasks client', async () => {
    const signer: HDNodeWallet = Wallet.createRandom();
    const id: number = 1;
    const signature: string = await signer.signMessage(`update-task:${id}:${signer.address.toLowerCase()}`);
    prismaMock.task.findUnique.mockResolvedValue(
      { id, client: '0x000000000000000000000000000000000000dead' } as unknown as Task,
    );

    await expect(
      taskService.updateTaskMetadata(id, { address: signer.address, signature }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('updates the task when the signer is the client', async () => {
    const signer: HDNodeWallet = Wallet.createRandom();
    const id: number = 1;
    const signature: string = await signer.signMessage(`update-task:${id}:${signer.address.toLowerCase()}`);
    prismaMock.task.findUnique.mockResolvedValue({ id, client: signer.address.toLowerCase() } as unknown as Task);
    prismaMock.task.update.mockResolvedValue({ id, title: 'New title here' } as unknown as Task);

    const result: Task = await taskService.updateTaskMetadata(id, {
      address: signer.address,
      signature,
      title: 'New title here',
    });

    expect(result).toEqual({ id, title: 'New title here' });
  });
});

describe('applyToTask', () => {
  async function signApplication (applicant: HDNodeWallet, taskId: number, message: string) {
    return applicant.signMessage(`apply:${taskId}:${message}`);
  }

  it('throws BadRequestError when the task is not open', async () => {
    const applicant: HDNodeWallet = Wallet.createRandom();
    const taskId: number = 1;
    const message: string = 'I would like to help with this task, thanks!';
    const signature: string = await signApplication(applicant, taskId, message);
    prismaMock.task.findUnique.mockResolvedValue({ id: taskId, status: 'ASSIGNED' } as unknown as Task);

    await expect(
      taskService.applyToTask(taskId, { applicant: applicant.address, message, signature }),
    ).rejects.toThrow(BadRequestError);
  });

  it('throws BadRequestError when the task client tries to apply to their own task', async () => {
    const client: HDNodeWallet = Wallet.createRandom();
    const taskId: number = 1;
    const message: string = 'I would like to help with this task, thanks!';
    const signature: string = await signApplication(client, taskId, message);
    prismaMock.task.findUnique.mockResolvedValue({
      id: taskId, status: 'OPEN', client: client.address.toLowerCase(),
    } as unknown as Task);

    await expect(
      taskService.applyToTask(taskId, { applicant: client.address, message, signature }),
    ).rejects.toThrow(BadRequestError);
  });

  it('throws ConflictError when the applicant already applied', async () => {
    const applicant: HDNodeWallet = Wallet.createRandom();
    const taskId: number = 1;
    const message: string = 'I would like to help with this task, thanks!';
    const signature: string = await signApplication(applicant, taskId, message);
    prismaMock.task.findUnique.mockResolvedValue({ id: taskId, status: 'OPEN' } as unknown as Task);
    prismaMock.application.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(
      taskService.applyToTask(taskId, { applicant: applicant.address, message, signature }),
    ).rejects.toThrow(ConflictError);
  });

  it('creates the application on success', async () => {
    const applicant: HDNodeWallet = Wallet.createRandom();
    const taskId: number = 1;
    const message: string = 'I would like to help with this task, thanks!';
    const signature: string = await signApplication(applicant, taskId, message);
    prismaMock.task.findUnique.mockResolvedValue({ id: taskId, status: 'OPEN' } as unknown as Task);
    prismaMock.application.create.mockResolvedValue({ id: 5, taskId, message } as unknown as Application);

    const result: Application = await taskService.applyToTask(
      taskId, { applicant: applicant.address, message, signature },
    );

    expect(result).toEqual({ id: 5, taskId, message });
  });
});

describe('addComment', () => {
  it('throws UnauthorizedError on an invalid signature', async () => {
    const author: HDNodeWallet = Wallet.createRandom();
    await expect(
      taskService.addComment(1, { author: author.address, content: 'hello', signature: '0xbad' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('creates the comment when the signature is valid', async () => {
    const author: HDNodeWallet = Wallet.createRandom();
    const taskId: number = 1;
    const content: string = 'Nice work on this';
    const signature: string = await author.signMessage(`comment:${taskId}:${content}`);
    prismaMock.comment.create.mockResolvedValue({ id: 1, taskId, content } as unknown as Comment);

    const result: Comment = await taskService.addComment(taskId, { author: author.address, content, signature });

    expect(result).toEqual({ id: 1, taskId, content });
  });
});
