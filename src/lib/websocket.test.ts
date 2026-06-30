import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { attachWebSocket, broadcast } from './websocket';

function startServer (): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server: Server = createServer();
    attachWebSocket(server);
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, port });
    });
  });
}

function open (ws: WebSocket): Promise<void> {
  return new Promise((res) => ws.on('open', () => res()));
}

function closed (ws: WebSocket): Promise<void> {
  return new Promise((res) => ws.on('close', () => res()));
}

describe('websocket chat', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    ({ server, port } = await startServer());
  });

  afterAll(() => new Promise<void>((res) => server.close(() => res())));

  it('delivers a broadcast to a client joined to the task room', async () => {
    const ws: WebSocket = new WebSocket(`ws://localhost:${port}/ws/chat/42`);
    await open(ws);

    const received: Promise<unknown> = new Promise<unknown>((res) =>
      ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => res(JSON.parse(data.toString()))),
    );
    broadcast(42, { type: 'message', data: { id: 1 } });

    expect(await received).toEqual({ type: 'message', data: { id: 1 } });

    ws.close();
    await closed(ws);
  });

  it('does not deliver a broadcast meant for a different task room', async () => {
    const ws: WebSocket = new WebSocket(`ws://localhost:${port}/ws/chat/1`);
    await open(ws);

    let got: boolean = false;
    ws.on('message', () => {
      got = true;
    });
    broadcast(2, { hello: 'world' });
    await new Promise((res) => setTimeout(res, 50));

    expect(got).toBe(false);

    ws.close();
    await closed(ws);
  });

  it('rejects an upgrade from a disallowed Origin', async () => {
    const ws: WebSocket = new WebSocket(`ws://localhost:${port}/ws/chat/1`, {
      headers: { Origin: 'http://evil.example.com' },
    });
    const result: string = await new Promise<string>((res) => {
      ws.on('open', () => res('open'));
      ws.on('error', () => res('error'));
    });
    expect(result).toBe('error');
  });

  it('rejects a path that is not /ws/chat/:id', async () => {
    const ws: WebSocket = new WebSocket(`ws://localhost:${port}/ws/other`);
    const result: string = await new Promise<string>((res) => {
      ws.on('open', () => res('open'));
      ws.on('error', () => res('error'));
    });
    expect(result).toBe('error');
  });

  it('broadcast to an empty room is a no-op', () => {
    expect(() => broadcast(999999, { x: 1 })).not.toThrow();
  });
});
