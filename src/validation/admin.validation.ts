import { z } from 'zod';

// Zod infers the exact builder type; a hand-written annotation would just restate it.
// eslint-disable-next-line @typescript-eslint/typedef
export const createChainSchema = z.object({
  chainId: z.number().int().positive(),
  rpcUrl: z.string().url(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
  startBlock: z.number().int().nonnegative().default(0),
  enabled: z.boolean().default(true),
});
export type CreateChainInput = z.infer<typeof createChainSchema>;

// eslint-disable-next-line @typescript-eslint/typedef
export const updateChainSchema = z.object({
  rpcUrl: z.string().url().optional(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address').optional(),
  startBlock: z.number().int().nonnegative().optional(),
  enabled: z.boolean().optional(),
});
export type UpdateChainInput = z.infer<typeof updateChainSchema>;
