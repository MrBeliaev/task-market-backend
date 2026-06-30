import type { Server } from 'http';

export const broadcast: jest.Mock<void, [taskId: number, payload: unknown]> = jest.fn();
export const attachWebSocket: jest.Mock<void, [server: Server]> = jest.fn();
