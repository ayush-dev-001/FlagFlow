import type { Request } from 'express';
import { z } from 'zod';
import { AppError } from './errors.js';

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);

/** The caller's org. Every org-scoped query filters on it; it never comes from the request body or URL. */
export function orgOf(req: Request): string {
  const orgId = req.auth?.orgId;
  if (!orgId) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this');
  return orgId;
}

const uuid = z.uuid();

/** A malformed id can't match anything, so it's the same 404 as a missing one. */
export function parseId(raw: unknown, what: string): string {
  const id = uuid.safeParse(raw);
  if (!id.success) throw notFound(what);
  return id.data;
}
