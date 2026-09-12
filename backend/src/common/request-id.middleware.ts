import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

// KNOWN_RISKS.md MED-8: nothing tied a logged error back to the request
// that caused it, or gave a client anything to hand back to support/on-call
// ("it failed, here's the id") - this stamps one per request, honoring a
// caller-supplied X-Request-Id (e.g. from a reverse proxy or another
// service in a call chain) rather than always minting a fresh one, so a
// trace can stay correlated across hops.
export interface RequestWithId extends Request {
  requestId: string;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.trim() ? incoming.trim() : randomUUID();
  (req as RequestWithId).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
