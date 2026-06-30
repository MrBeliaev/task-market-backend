import { ethers } from 'ethers';
import type {
  Prisma,
  TaskStatus,
  ChainConfig,
  Task,
  DisputeMessage,
} from '../generated/prisma/client';
import {
  prisma,
  config,
  isPrismaError,
  NotFoundError,
} from '../lib';
import type { ChainRpcConfig } from '../types';
import type { CreateChainInput, UpdateChainInput } from '../validation';

const ADMIN_ABI: readonly string[] = [
  'function hasRole(bytes32 role, address account) view returns (bool)',
] as const;

// Computed once at module load: keccak256("ADMIN_ROLE")
const ADMIN_ROLE_HASH: string = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'));
const DEFAULT_ADMIN_ROLE_HASH: string = '0x' + '00'.repeat(32);

interface AdminCacheEntry {
  isAdmin: boolean;
  expiry: number;
}

// Simple in-memory cache: "chainId:address" → { result, expiry }
const adminCache: Map<string, AdminCacheEntry> = new Map();
const CACHE_TTL_MS: number = 30_000;

// Resolves the RPC URL + contract address to use for a given chain, preferring
// the per-chain config stored in the database (managed via the Networks admin
// tab) and falling back to the server's default chain from env config.
async function getChainRpcConfig (chainId: number): Promise<ChainRpcConfig | null> {
  const chain: ChainConfig | null = await prisma.chainConfig.findUnique({ where: { chainId } });
  if (chain && chain.enabled) {
    return { rpcUrl: chain.rpcUrl, contractAddress: chain.contractAddress };
  }

  if (chainId === config.blockchain.chainId && config.blockchain.contractAddress) {
    return { rpcUrl: config.blockchain.rpcUrl, contractAddress: config.blockchain.contractAddress };
  }

  return null;
}

/** Checks ADMIN_ROLE / DEFAULT_ADMIN_ROLE for a specific chain, using its configured RPC + contract. */
export async function checkAdminOnChain (address: string, chainId: number): Promise<boolean> {
  const cacheKey: string = `${chainId}:${address}`;
  const cached: AdminCacheEntry | undefined = adminCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.isAdmin;
  }

  const chainConfig: ChainRpcConfig | null = await getChainRpcConfig(chainId);
  if (!chainConfig) {
    throw new Error(`No contract configured for chain ${chainId}`);
  }

  const provider: ethers.JsonRpcProvider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
  const contract: ethers.Contract = new ethers.Contract(chainConfig.contractAddress, ADMIN_ABI, provider);

  const [hasAdminRole, hasDefaultAdminRole] = await Promise.all([
    contract.hasRole(ADMIN_ROLE_HASH, address) as Promise<boolean>,
    contract.hasRole(DEFAULT_ADMIN_ROLE_HASH, address) as Promise<boolean>,
  ]);
  const result: boolean = hasAdminRole || hasDefaultAdminRole;

  adminCache.set(cacheKey, { isAdmin: result, expiry: Date.now() + CACHE_TTL_MS });
  return result;
}

/**
 * Checks ADMIN_ROLE / DEFAULT_ADMIN_ROLE against the server's single default chain
 * (env-configured, uncached). Used by the dispute chat, which doesn't carry a chainId.
 * Resolves to false (rather than throwing) when the check can't be made.
 */
export async function isDefaultChainAdmin (address: string): Promise<boolean> {
  if (!config.blockchain.contractAddress) {
    return false;
  }

  try {
    const provider: ethers.JsonRpcProvider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    const contract: ethers.Contract = new ethers.Contract(config.blockchain.contractAddress, ADMIN_ABI, provider);
    const [hasAdmin, hasDefault] = await Promise.all([
      contract.hasRole(ADMIN_ROLE_HASH, address) as Promise<boolean>,
      contract.hasRole(DEFAULT_ADMIN_ROLE_HASH, address) as Promise<boolean>,
    ]);
    return hasAdmin || hasDefault;
  } catch {
    return false;
  }
}

export async function listAdminTasks (status?: string): Promise<Task[]> {
  const where: Prisma.TaskWhereInput = status ? { status: status as TaskStatus } : {};
  return prisma.task.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { applications: true, comments: true, disputeMessages: true } },
    },
  });
}

export async function getTaskDispute (id: number): Promise<{ task: Task; messages: DisputeMessage[] }> {
  const [task, messages] = await Promise.all([
    prisma.task.findUnique({ where: { id } }),
    prisma.disputeMessage.findMany({ where: { taskId: id }, orderBy: { createdAt: 'asc' } }),
  ]);
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  return { task, messages };
}

export async function listChains (): Promise<ChainConfig[]> {
  return prisma.chainConfig.findMany({ orderBy: { chainId: 'asc' } });
}

/** Public chain registry: chainId + contractAddress only, enabled chains only. */
export async function listPublicChains (): Promise<Pick<ChainConfig, 'chainId' | 'contractAddress'>[]> {
  return prisma.chainConfig.findMany({
    where: { enabled: true },
    select: { chainId: true, contractAddress: true },
    orderBy: { chainId: 'asc' },
  });
}

export async function createChain (data: CreateChainInput): Promise<ChainConfig> {
  return prisma.chainConfig.create({ data });
}

export async function updateChain (chainId: number, data: UpdateChainInput): Promise<ChainConfig> {
  try {
    return await prisma.chainConfig.update({ where: { chainId }, data });
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      throw new NotFoundError('Chain not found');
    }

    throw error;
  }
}
