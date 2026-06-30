import { z } from 'zod';

export const ethereumAddress: z.ZodString = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const signature: z.ZodString = z.string().min(1, 'Signature required');
