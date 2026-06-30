import { Wallet, type HDNodeWallet } from 'ethers';
import { mockReset, type DeepMockProxy } from 'jest-mock-extended';
import { prisma } from '../lib/db';
import type { PrismaClient, DisputeMessage, Task } from '../generated/prisma/client';
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from '../lib/errors';
import { isDefaultChainAdmin } from './admin.service';
import * as disputeService from './dispute.service';

jest.mock('../lib/db');
jest.mock('./admin.service');

const prismaMock: DeepMockProxy<PrismaClient> = prisma as unknown as DeepMockProxy<PrismaClient>;
const isDefaultChainAdminMock: jest.MaybeMockedDeep<typeof isDefaultChainAdmin> = jest.mocked(isDefaultChainAdmin);

beforeEach(() => {
  mockReset(prismaMock);
  isDefaultChainAdminMock.mockReset();
  isDefaultChainAdminMock.mockResolvedValue(false);
});

describe('getDisputeMessages', () => {
  it('throws NotFoundError when the task does not exist', async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);

    await expect(disputeService.getDisputeMessages(1)).rejects.toThrow(NotFoundError);
  });
});

describe('postDisputeMessage', () => {
  const client: HDNodeWallet = Wallet.createRandom();
  const outsider: HDNodeWallet = Wallet.createRandom();
  const admin: HDNodeWallet = Wallet.createRandom();

  async function sign (wallet: typeof client, taskId: number, content: string) {
    return wallet.signMessage(`dispute:${taskId}:${content}`);
  }

  it('throws UnauthorizedError on a bad signature', async () => {
    await expect(
      disputeService.postDisputeMessage(1, { sender: client.address, content: 'hi', signature: '0xbad' }, {}),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws ForbiddenError when sender is neither a participant nor admin', async () => {
    const content: string = 'hi';
    const signature: string = await sign(outsider, 1, content);
    prismaMock.task.findUnique.mockResolvedValue({
      id: 1, status: 'DISPUTED', client: client.address.toLowerCase(), executor: null,
    } as Task);

    await expect(
      disputeService.postDisputeMessage(1, { sender: outsider.address, content, signature }, {}),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws BadRequestError when a non-admin participant posts outside DISPUTED status', async () => {
    const content: string = 'hi';
    const signature: string = await sign(client, 1, content);
    prismaMock.task.findUnique.mockResolvedValue({
      id: 1, status: 'ASSIGNED', client: client.address.toLowerCase(), executor: null,
    } as Task);

    await expect(
      disputeService.postDisputeMessage(1, { sender: client.address, content, signature }, {}),
    ).rejects.toThrow(BadRequestError);
  });

  it('allows an admin to post even when the task is not DISPUTED', async () => {
    const content: string = 'admin note';
    const signature: string = await sign(admin, 1, content);
    prismaMock.task.findUnique.mockResolvedValue({
      id: 1, status: 'ASSIGNED', client: client.address.toLowerCase(), executor: null,
    } as Task);
    isDefaultChainAdminMock.mockResolvedValue(true);
    prismaMock.disputeMessage.create.mockResolvedValue({ id: 1, content, isAdmin: true } as DisputeMessage);

    const result: DisputeMessage = await disputeService.postDisputeMessage(
      1, { sender: admin.address, content, signature }, {},
    );

    expect(result).toEqual({ id: 1, content, isAdmin: true });
    expect(prismaMock.disputeMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isAdmin: true }) }),
    );
  });

  it('allows the task client to post while DISPUTED', async () => {
    const content: string = 'client note';
    const signature: string = await sign(client, 1, content);
    prismaMock.task.findUnique.mockResolvedValue({
      id: 1, status: 'DISPUTED', client: client.address.toLowerCase(), executor: null,
    } as Task);
    prismaMock.disputeMessage.create.mockResolvedValue({ id: 2, content, isAdmin: false } as DisputeMessage);

    const result: DisputeMessage = await disputeService.postDisputeMessage(
      1, { sender: client.address, content, signature }, {},
    );

    expect(result).toEqual({ id: 2, content, isAdmin: false });
  });
});
