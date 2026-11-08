import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';
import { config } from '../config/index.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled request error');

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: 'Invalid resource identifier format'
    });
    return;
  }

  if (err.code === 11000 || err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    res.status(409).json({
      success: false,
      error: 'Duplicate record conflict'
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const message =
    config.env === 'production' && statusCode === 500
      ? 'An unexpected internal server error occurred'
      : err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.env !== 'production' && { stack: err.stack })
  });
}
