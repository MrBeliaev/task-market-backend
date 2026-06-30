import { z } from 'zod';
import { ethereumAddress, signature } from './ethereum.validation';

// Shared by task chat and dispute chat: sender + content + signature, optional file upload.
// Zod infers the exact builder type; a hand-written annotation would just restate it.
// eslint-disable-next-line @typescript-eslint/typedef
export const postMessageSchema = z.object({
  sender: ethereumAddress,
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long (max 5000 chars)'),
  signature,
});
export type PostMessageInput = z.infer<typeof postMessageSchema>;
