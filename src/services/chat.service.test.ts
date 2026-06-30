import { Wallet, type HDNodeWallet } from 'ethers';
import { mockReset, type DeepMockProxy } from 'jest-mock-extended';
import { prisma } from '../lib/db';
import { broadcast } from '../lib/websocket';
import type { PrismaClient, Task, TaskMessage } from '../generated/prisma/client';
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from '../lib/errors';
import * as chatService from './chat.service';

jest.mock('../lib/db');
jest.mock('../lib/websocket');

const prismaMock: DeepMockProxy<PrismaClient> = prisma as unknown as DeepMockProxy<PrismaClient>;
const broadcastMock: jest.Mock<void, [taskId: number, payload: unknown]> = broadcast as jest.Mock;

beforeEach(() => {
  mockReset(prismaMock);
  broadcastMock.mockReset();
});

describe('getMessages', () => {
  it('throws NotFoundError when the task does not exist', async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);

    await expect(chatService.getMessages(1)).rejects.toThrow(NotFoundError);
  });

  it('returns the tasks messages', async () => {
    prismaMock.task.findUnique.mockResolvedValue({ id: 1 } as Task);
    prismaMock.taskMessage.findMany.mockResolvedValue([{ id: 1, content: 'hi' }] as unknown as TaskMessage[]);

    const result: TaskMessage[] = await chatService.getMessages(1);

    expect(result).toEqual([{ id: 1, content: 'hi' }]);
  });
});

describe('postMessage', () => {
  const client: HDNodeWallet = Wallet.createRandom();
  const executor: HDNodeWallet = Wallet.createRandom();
  const outsider: HDNodeWallet = Wallet.createRandom();

  async function sign (wallet: typeof client, taskId: number, content: string) {
    return wallet.signMessage(`chat:${taskId}:${content}`);
  }

  it('throws UnauthorizedError on a bad signature', async () => {
    await expect(
      chatService.postMessage(1, { sender: client.address, content: 'hi', signature: '0xbad' }, {}),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws NotFoundError when the task does not exist', async () => {
    const content: string = 'hello';
    const signature: string = await sign(client, 1, content);
    prismaMock.task.findUnique.mockResolvedValue(null);

    await expect(
      chatService.postMessage(1, { sender: client.address, content, signature }, {}),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws BadRequestError when the task is still OPEN', async () => {
    const content: string = 'hello';
    const signature: string = await sign(client, 1, content);
    prismaMock.task.findUnique.mockResolvedValue({
      id: 1, status: 'OPEN', client: client.address.toLowerCase(), executor: null,
    } as Task);

    await expect(
      chatService.postMessage(1, { sender: client.address, content, signature }, {}),
    ).rejects.toThrow(BadRequestError);
  });

  it('throws ForbiddenError when the sender is not the client or executor', async () => {
    const content: string = 'hello';
    const signature: string = await sign(outsider, 1, content);
    prismaMock.task.findUnique.mockResolvedValue({
      id: 1, status: 'ASSIGNED', client: client.address.toLowerCase(), executor: executor.address.toLowerCase(),
    } as Task);

    await expect(
      chatService.postMessage(1, { sender: outsider.address, content, signature }, {}),
    ).rejects.toThrow(ForbiddenError);
  });

  it('creates the message and broadcasts it when the executor posts', async () => {
    const content: string = 'hello';
    const signature: string = await sign(executor, 1, content);
    prismaMock.task.findUnique.mockResolvedValue({
      id: 1, status: 'ASSIGNED', client: client.address.toLowerCase(), executor: executor.address.toLowerCase(),
    } as Task);
    prismaMock.taskMessage.create.mockResolvedValue({ id: 5, taskId: 1, content } as TaskMessage);

    const result: TaskMessage = await chatService.postMessage(1, { sender: executor.address, content, signature }, {});

    expect(result).toEqual({ id: 5, taskId: 1, content });
    expect(broadcastMock).toHaveBeenCalledWith(1, { type: 'message', data: result });
  });
});
