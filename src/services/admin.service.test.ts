import { mockReset, type DeepMockProxy } from 'jest-mock-extended';
import { prisma } from '../lib/db';
import {
  Prisma,
  type PrismaClient,
  type Task,
  type DisputeMessage,
  type ChainConfig,
} from '../generated/prisma/client';
import { NotFoundError } from '../lib/errors';
import type { CreateChainInput } from '../validation';
import * as adminService from './admin.service';

jest.mock('../lib/db');

const prismaMock: DeepMockProxy<PrismaClient> = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});

describe('listAdminTasks', () => {
  it('lists all tasks when no status filter is given', async () => {
    prismaMock.task.findMany.mockResolvedValue([{ id: 1 }] as unknown as Task[]);

    const result: Task[] = await adminService.listAdminTasks();

    expect(result).toEqual([{ id: 1 }]);
    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('filters by status when given', async () => {
    prismaMock.task.findMany.mockResolvedValue([]);

    await adminService.listAdminTasks('DISPUTED');

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'DISPUTED' } }),
    );
  });
});

describe('getTaskDispute', () => {
  it('throws NotFoundError when the task does not exist', async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);
    prismaMock.disputeMessage.findMany.mockResolvedValue([]);

    await expect(adminService.getTaskDispute(1)).rejects.toThrow(NotFoundError);
  });

  it('returns the task with its dispute messages', async () => {
    prismaMock.task.findUnique.mockResolvedValue({ id: 1 } as unknown as Task);
    prismaMock.disputeMessage.findMany.mockResolvedValue([{ id: 9 }] as unknown as DisputeMessage[]);

    const result: { task: Task; messages: DisputeMessage[] } = await adminService.getTaskDispute(1);

    expect(result).toEqual({ task: { id: 1 }, messages: [{ id: 9 }] });
  });
});

describe('listChains / listPublicChains', () => {
  it('listChains returns every configured chain', async () => {
    prismaMock.chainConfig.findMany.mockResolvedValue([{ chainId: 1 }] as ChainConfig[]);

    const result: ChainConfig[] = await adminService.listChains();

    expect(result).toEqual([{ chainId: 1 }]);
  });

  it('listPublicChains selects only chainId and contractAddress for enabled chains', async () => {
    prismaMock.chainConfig.findMany.mockResolvedValue([{ chainId: 1, contractAddress: '0xabc' }] as ChainConfig[]);

    await adminService.listPublicChains();

    expect(prismaMock.chainConfig.findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      select: { chainId: true, contractAddress: true },
      orderBy: { chainId: 'asc' },
    });
  });
});

describe('createChain', () => {
  it('creates a chain config', async () => {
    const data: CreateChainInput = {
      chainId: 1, rpcUrl: 'https://rpc.example.com', contractAddress: '0xabc', startBlock: 0, enabled: true,
    };
    prismaMock.chainConfig.create.mockResolvedValue(data as ChainConfig);

    const result: ChainConfig = await adminService.createChain(data);

    expect(result).toEqual(data);
  });
});

describe('updateChain', () => {
  it('throws NotFoundError when the chain does not exist (P2025)', async () => {
    prismaMock.chainConfig.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('missing', { code: 'P2025', clientVersion: 'test' }),
    );

    await expect(adminService.updateChain(999, { enabled: false })).rejects.toThrow(NotFoundError);
  });

  it('re-throws unrelated errors', async () => {
    prismaMock.chainConfig.update.mockRejectedValue(new Error('connection lost'));

    await expect(adminService.updateChain(1, { enabled: false })).rejects.toThrow('connection lost');
  });

  it('updates the chain on success', async () => {
    prismaMock.chainConfig.update.mockResolvedValue({ chainId: 1, enabled: false } as ChainConfig);

    const result: ChainConfig = await adminService.updateChain(1, { enabled: false });

    expect(result).toEqual({ chainId: 1, enabled: false });
  });
});
