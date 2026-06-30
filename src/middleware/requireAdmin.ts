import type { Request, Response, NextFunction } from 'express';
import { signatureService, adminService } from '../services';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ServiceUnavailableError,
  getErrorMessage,
} from '../lib';

/**
 * Admin authentication middleware. The admin signs `admin:${timestamp}` with their wallet.
 * The timestamp must be within 60 seconds of the server clock to limit replay.
 * Headers: X-Admin-Address, X-Admin-Signature, X-Admin-Timestamp, X-Admin-Chain-Id
 */
export async function requireAdmin (req: Request, _res: Response, next: NextFunction): Promise<void> {
  const address: string | undefined    = (req.headers['x-admin-address']  as string | undefined)?.toLowerCase();
  const signature: string | undefined  = req.headers['x-admin-signature'] as string | undefined;
  const tsRaw: string | undefined      = req.headers['x-admin-timestamp'] as string | undefined;
  const chainIdRaw: string | undefined = req.headers['x-admin-chain-id']  as string | undefined;

  if (!address || !signature || !tsRaw || !chainIdRaw) {
    throw new UnauthorizedError(
      'Admin headers required: X-Admin-Address, X-Admin-Signature, X-Admin-Timestamp, X-Admin-Chain-Id',
    );
  }

  const chainId: number = parseInt(chainIdRaw, 10);
  if (isNaN(chainId)) {
    throw new BadRequestError('Invalid X-Admin-Chain-Id');
  }

  const ts: number = parseInt(tsRaw, 10);
  // Reject timestamps more than 60 s from the server clock in either direction.
  // Without the lower bound a future timestamp keeps a signature valid well past 60 s.
  if (isNaN(ts) || Math.abs(Date.now() - ts) > 60_000) {
    throw new UnauthorizedError('Admin timestamp expired (max 60 seconds)');
  }

  const message: string = `admin:${ts}`;
  if (!signatureService.verifySignature(address, message, signature)) {
    throw new UnauthorizedError('Invalid admin signature');
  }

  let isAdmin: boolean;
  try {
    isAdmin = await adminService.checkAdminOnChain(address, chainId);
  } catch (err: unknown) {
    throw new ServiceUnavailableError(`Admin check failed: ${getErrorMessage(err)}`);
  }

  if (!isAdmin) {
    throw new ForbiddenError('Address is not a registered admin or owner');
  }

  next();
}
