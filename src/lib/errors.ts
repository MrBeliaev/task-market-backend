import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';

/** Base class for errors that carry an HTTP status code through to the response. */
export class AppError extends Error {
  constructor (
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BadRequestError extends AppError {
  constructor (message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor (message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor (message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor (message = 'Not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor (message: string) {
    super(message, 409);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor (message: string) {
    super(message, 503);
  }
}

/** Extracts a human-readable message from an unknown thrown value. */
export function getErrorMessage (error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/** Returns true for Prisma errors that match a specific error code. */
export function isPrismaError (
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

/**
 * Returns true for errors that represent real server-side bugs
 * that require investigation, not routine client or expected DB errors.
 */
export function isAlertable (error: unknown): boolean {
  // 4xx AppErrors are expected client-driven outcomes, not server bugs
  if (error instanceof AppError) {
    return error.status >= 500;
  }

  // Validation error: bad client input, not a server bug
  if (error instanceof ZodError) {
    return false;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 unique constraint → 409 Conflict (expected for duplicate applications)
    // P2025 record not found → 404 (expected route behavior)
    if (error.code === 'P2002' || error.code === 'P2025') {
      return false;
    }
  }

  return true;
}
