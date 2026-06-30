import type { Task, Application, Comment } from '../generated/prisma/client';

export interface StatsData {
  chainId: number | null;
  totalTasks: number;
  statusBreakdown: Record<string, number>;
  totalValueLockedWei: string;
}

export type TaskWithCounts = Task & {
  _count: { applications: number; comments: number };
};

export type TaskWithRelations = Task & {
  applications: Application[];
  comments: Comment[];
};

export interface PaginatedTasks {
  tasks: TaskWithCounts[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
