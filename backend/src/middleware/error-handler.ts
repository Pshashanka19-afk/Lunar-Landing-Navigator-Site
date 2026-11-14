import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../types/errors';
import { logger } from './logger';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.id || 'unknown';

  if (err instanceof AppError) {
    logger.warn({
      requestId,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      requestId,
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({
      requestId,
      code: 'VALIDATION_ERROR',
      issues: err.issues,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
      requestId,
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn({ requestId, error: err.message }, 'Malformed JSON in request body');
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body',
      },
      requestId,
    });
    return;
  }

  // Unhandled internal server errors
  logger.error({ requestId, err }, 'Unhandled server error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred. Please contact the mission support team.',
      details: env.NODE_ENV === 'development' ? err.message : undefined,
    },
    requestId,
  });
}
