import dotenv from 'dotenv';
dotenv.config();

interface Config {
  readonly env: string;
  readonly logLevel: string;
  readonly port: number;
  readonly corsOrigin: string;
  readonly database: {
    readonly url: string;
  };
  readonly blockchain: {
    readonly rpcUrl: string;
    readonly contractAddress: string;
    readonly chainId: number;
    readonly startBlock: number;
  };
  readonly indexer: {
    readonly pollingIntervalMs: number;
  };
}

export const config: Config = {
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  blockchain: {
    rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
    contractAddress: process.env.CONTRACT_ADDRESS || '',
    chainId: parseInt(process.env.CHAIN_ID || '31337', 10),
    startBlock: parseInt(process.env.START_BLOCK || '0', 10),
  },
  indexer: {
    pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '5000', 10),
  },
};
