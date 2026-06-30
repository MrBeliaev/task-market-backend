import { z } from 'zod';
import { ethereumAddress, signature } from './ethereum.validation';

// Zod infers the exact builder type; a hand-written annotation would just restate it.
// eslint-disable-next-line @typescript-eslint/typedef
export const createTaskSchema = z.object({
  onChainId: z.number().int().positive(),
  chainId: z.number().int().positive(),
  client: ethereumAddress,
  signature,
  reward: z.string(),
  deadline: z.string().datetime(),
  metadataHash: z.string(),
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  contactInfo: z.string().min(3).max(500),
  referenceLink: z.string().url().max(500).optional(),
  category: z.string().max(100).optional(),
  skills: z.array(z.string().max(50)).max(10).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// Zod infers the exact builder type; a hand-written annotation would just restate it.
// eslint-disable-next-line @typescript-eslint/typedef
export const applyToTaskSchema = z.object({
  applicant: ethereumAddress,
  message: z.string().min(10).max(2000),
  signature,
});
export type ApplyToTaskInput = z.infer<typeof applyToTaskSchema>;

// eslint-disable-next-line @typescript-eslint/typedef
export const addCommentSchema = z.object({
  author: ethereumAddress,
  content: z.string().min(1).max(2000),
  signature,
});
export type AddCommentInput = z.infer<typeof addCommentSchema>;

// eslint-disable-next-line @typescript-eslint/typedef
export const updateTaskMetadataSchema = z.object({
  address: ethereumAddress,
  signature,
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(20).max(5000).optional(),
  contactInfo: z.string().min(3).max(500).optional(),
  referenceLink: z.string().url().max(500).optional(),
  category: z.string().max(100).optional(),
  skills: z.array(z.string().max(50)).max(10).optional(),
});
export type UpdateTaskMetadataInput = z.infer<typeof updateTaskMetadataSchema>;

// eslint-disable-next-line @typescript-eslint/typedef
export const queryTasksSchema = z.object({
  chainId: z.coerce.number().int().positive().optional(),
  status: z
    .enum([
      'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW',
      'COMPLETED', 'DISPUTED', 'CANCELLED',
    ])
    .optional(),
  category: z.string().optional(),
  client: ethereumAddress.optional(),
  executor: ethereumAddress.optional(),
  excludeClient: ethereumAddress.optional(),
  deadlineAfter: z.string().datetime().optional(),
  deadlineBefore: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type QueryTasksInput = z.infer<typeof queryTasksSchema>;
