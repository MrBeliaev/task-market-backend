import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import type { PrismaClient } from '../../generated/prisma/client';

export const prisma: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();
