import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { config } from './config';

const adapter: PrismaPg = new PrismaPg({ connectionString: config.database.url });

export const prisma: PrismaClient = new PrismaClient({ adapter });
