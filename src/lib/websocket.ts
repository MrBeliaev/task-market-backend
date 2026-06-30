import { IncomingMessage, Server } from 'http';
import { URL } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';

// Per-task room: taskId → set of connected clients
const rooms: Map<number, Set<WebSocket>> = new Map();

// Cap concurrent listeners per task to bound memory and limit a trivial DoS.
const MAX_CLIENTS_PER_ROOM: number = 200;

// Browsers always send an Origin header; require it to match the configured
// CORS origin. Non-browser clients (no Origin) are allowed, mirroring how the
// HTTP API treats them — posting still requires a wallet signature.
function isAllowedOrigin (origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  return origin === config.corsOrigin;
}

function join (taskId: number, ws: WebSocket): void {
  let room: Set<WebSocket> | undefined = rooms.get(taskId);
  if (!room) {
    room = new Set();
    rooms.set(taskId, room);
  }

  room.add(ws);
}

function leave (taskId: number, ws: WebSocket): void {
  const room: Set<WebSocket> | undefined = rooms.get(taskId);
  if (!room) {
    return;
  }

  room.delete(ws);

  if (room.size === 0) {
    rooms.delete(taskId);
  }
}

export function broadcast (taskId: number, payload: unknown): void {
  const room: Set<WebSocket> | undefined = rooms.get(taskId);
  if (!room) {
    return;
  }

  const data: string = JSON.stringify(payload);
  for (const client of room) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Attach WS upgrade handler to the HTTP server.
// Accepts connections on: /ws/chat/:taskId
export function attachWebSocket (server: Server): void {
  const wss: WebSocketServer = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    if (!isAllowedOrigin(req.headers.origin)) {
      socket.destroy();
      return;
    }

    const base: string = `ws://${req.headers.host ?? 'localhost'}`;
    let url: URL;
    try {
      url = new URL(req.url ?? '', base);
    } catch {
      socket.destroy();
      return;
    }

    const match: RegExpMatchArray | null = url.pathname.match(/^\/ws\/chat\/(\d+)$/);
    if (!match) {
      socket.destroy();
      return;
    }

    const taskId: number = parseInt(match[1], 10);

    if ((rooms.get(taskId)?.size ?? 0) >= MAX_CLIENTS_PER_ROOM) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      join(taskId, ws);

      ws.on('close', () => leave(taskId, ws));
      // Clients are receive-only: sending happens via HTTP POST
      ws.on('message', () => {
        /* intentionally ignored */
      });
    });
  });
}
