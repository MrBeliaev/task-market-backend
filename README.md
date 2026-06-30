# TaskMarket Backend

REST API and WebSocket server for TaskMarket, a decentralised task marketplace on Ethereum.
The backend stores off-chain task metadata, verifies wallet signatures, exposes an admin API
gated by on-chain roles, and relays dispute and task chat over WebSocket.

It does not hold private keys or move funds. Escrow and state transitions live in the smart
contract; this service indexes and serves the data around them.

## Stack

- Express 5 with a layered architecture
- Prisma 7 with the `@prisma/adapter-pg` driver adapter (PostgreSQL)
- Zod 4 for request validation
- pino for structured logging (pretty-printed in development)
- `ws` for WebSocket chat
- ethers v6 for signature recovery and contract reads
- Jest for tests

## Architecture

Code flows in one direction through layers:

```
types/ -> validation/ -> services/ -> controllers/ -> middleware/ -> routes/
```

Shared infrastructure (Prisma client, config, errors, logger, file upload, Swagger spec,
WebSocket hub) lives in `lib/`. Each request is validated by a Zod schema, handled by a
service that owns the business logic, and wrapped by a thin controller. Mutating endpoints
require an EIP-191 wallet signature; admin endpoints additionally check `ADMIN_ROLE` on-chain.

## Getting started

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL, CONTRACT_ADDRESS, RPC_URL
npm run db:migrate          # apply Prisma migrations
npm run dev                 # start with hot reload (tsx watch)
```

The Prisma client is generated into `src/generated/prisma`; the datasource URL is supplied
through the driver adapter, not the schema.

## Scripts

| Script                     | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `npm run dev`              | Start the server with hot reload                 |
| `npm run build`            | Compile TypeScript to `dist/`                    |
| `npm start`                | Run the compiled server                          |
| `npm test`                 | Run the Jest suite                               |
| `npm run lint`             | Lint `src/` with ESLint                          |
| `npm run db:migrate`       | Apply Prisma migrations (dev)                    |
| `npm run db:generate`      | Regenerate the Prisma client                     |
| `npm run db:seed`          | Seed a default `chain_config` row from env       |
| `npm run dependency:check` | Fail on circular imports (madge)                 |

## Environment

| Variable             | Description                                              |
| -------------------- | ------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string                            |
| `PORT`               | HTTP port (default 3001)                                |
| `CORS_ORIGIN`        | Allowed browser origin                                  |
| `CONTRACT_ADDRESS`   | Deployed TaskMarket address (for on-chain admin checks) |
| `RPC_URL`            | JSON-RPC endpoint for the default chain                 |
| `LOG_LEVEL`          | pino level, default `info`                              |
| `TELEGRAM_BOT_TOKEN` | Optional, enables error alerts                          |
| `TELEGRAM_CHAT_ID`   | Optional, target chat for alerts                        |

## API docs

Swagger UI is served at `/api/docs` and the raw spec at `/api/docs.json` once the server runs.

## WebSocket

Clients connect to `ws://<host>/ws/chat/:taskId` to receive task and dispute messages in real
time. The socket is receive-only; posting goes through signed HTTP requests, so messages cannot
be forged over the socket.

## License

MIT
