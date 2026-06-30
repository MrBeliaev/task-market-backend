// Augments Express Request with fields added by application middleware.
// Must be a module (not a script), hence the bare export.
export {};

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}
