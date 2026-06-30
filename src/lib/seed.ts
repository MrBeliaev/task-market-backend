import { prisma } from './db';
import { config } from './config';
import { logger } from './logger';

/**
 * Seeds a single chain_config row from env (CHAIN_ID, RPC_URL, CONTRACT_ADDRESS,
 * START_BLOCK) so a fresh deployment can index and resolve a contract out of the
 * box. No-op when CONTRACT_ADDRESS is not set; multi-chain setups manage rows via
 * the admin API instead.
 */
export async function seedDefaultChainFromEnv (): Promise<void> {
  const { chainId, rpcUrl, contractAddress, startBlock } = config.blockchain;
  if (!contractAddress) {
    return;
  }

  await prisma.chainConfig.upsert({
    where: { chainId },
    update: { rpcUrl, contractAddress, startBlock },
    create: { chainId, rpcUrl, contractAddress, startBlock, enabled: true },
  });
  logger.info(`chain_config ready for chain ${chainId} -> ${contractAddress}`);
}

// Allow running standalone: `npm run db:seed`.
if (require.main === module) {
  seedDefaultChainFromEnv()
    .then(() => prisma.$disconnect())
    .catch((err: unknown) => {
      logger.error({ err }, 'seed failed');
      process.exit(1);
    });
}
