import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  getErrorMessage,
  isPrismaError,
  isAlertable,
} from './errors';

function prismaError (code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });
}

describe('AppError subclasses', () => {
  it('BadRequestError carries status 400 and the given message', () => {
    const err: BadRequestError = new BadRequestError('bad input');
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('bad input');
    expect(err.name).toBe('BadRequestError');
  });

  it('UnauthorizedError defaults to status 401', () => {
    const err: UnauthorizedError = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
  });

  it('ForbiddenError defaults to status 403', () => {
    expect(new ForbiddenError().status).toBe(403);
  });

  it('NotFoundError defaults to status 404', () => {
    expect(new NotFoundError().status).toBe(404);
  });

  it('ConflictError carries status 409', () => {
    expect(new ConflictError('duplicate').status).toBe(409);
  });

  it('ServiceUnavailableError carries status 503', () => {
    expect(new ServiceUnavailableError('down').status).toBe(503);
  });
});

describe('getErrorMessage', () => {
  it('returns the message for Error instances', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns a generic message for non-Error values', () => {
    expect(getErrorMessage('not an error')).toBe('An unexpected error occurred');
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
  });
});

describe('isPrismaError', () => {
  it('matches a PrismaClientKnownRequestError with the given code', () => {
    const err: import('@prisma/client-runtime-utils').PrismaClientKnownRequestError = prismaError('P2002');
    expect(isPrismaError(err, 'P2002')).toBe(true);
    expect(isPrismaError(err, 'P2025')).toBe(false);
  });

  it('returns false for non-Prisma errors', () => {
    expect(isPrismaError(new Error('nope'), 'P2002')).toBe(false);
  });
});

describe('isAlertable', () => {
  it('is false for AppErrors below 500', () => {
    expect(isAlertable(new BadRequestError('bad'))).toBe(false);
    expect(isAlertable(new NotFoundError())).toBe(false);
  });

  it('is true for AppErrors at or above 500', () => {
    expect(isAlertable(new ServiceUnavailableError('down'))).toBe(true);
  });

  it('is false for ZodError', () => {
    const result: z.ZodSafeParseResult<{ a: string }> = z.object({ a: z.string() }).safeParse({});
    expect(result.success).toBe(false);
    expect(isAlertable(result.error)).toBe(false);
  });

  it('is false for expected Prisma error codes (P2002, P2025)', () => {
    expect(isAlertable(prismaError('P2002'))).toBe(false);
    expect(isAlertable(prismaError('P2025'))).toBe(false);
  });

  it('is true for other Prisma error codes', () => {
    expect(isAlertable(prismaError('P2003'))).toBe(true);
  });

  it('is true for unexpected errors', () => {
    expect(isAlertable(new Error('totally unexpected'))).toBe(true);
  });
});
