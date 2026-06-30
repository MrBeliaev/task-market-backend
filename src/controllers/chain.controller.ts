import type { Request, Response } from 'express';
import type { ChainConfig } from '../generated/prisma/client';
import { adminService } from '../services';

/** No auth required: frontend uses this to resolve the contract address. */
export async function listPublicChains (_req: Request, res: Response): Promise<void> {
  const chains: Pick<ChainConfig, 'chainId' | 'contractAddress'>[] = await adminService.listPublicChains();
  res.json(chains);
}
