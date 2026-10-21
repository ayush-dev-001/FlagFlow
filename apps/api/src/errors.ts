import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** An error that is safe to show the caller, rendered as `{ error: { code, message, details? } }`. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));
};

// body-parser errors carry a `type` and an HTTP `status`.
function bodyParserError(err: unknown): AppError | undefined {
  if (typeof err !== 'object' || err === null || !('type' in err)) return undefined;
  switch (err.type) {
    case 'entity.too.large':
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    case 'entity.parse.failed':
      return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
    case 'encoding.unsupported':
    case 'charset.unsupported':
      return new AppError(415, 'UNSUPPORTED_ENCODING', 'Unsupported request body encoding');
    default:
      return undefined;
  }
}

function toAppError(err: unknown): AppError | undefined {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details);
  }
  return bodyParserError(err);
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const known = toAppError(err);
  if (!known) {
    // Unexpected: log everything, tell the caller nothing.
    req.log.error({ err }, 'unhandled error');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    return;
  }
  if (known.status >= 500) req.log.error({ err }, known.message);
  res.status(known.status).json({
    error: {
      code: known.code,
      message: known.message,
      ...(known.details !== undefined && { details: known.details }),
    },
  });
};
