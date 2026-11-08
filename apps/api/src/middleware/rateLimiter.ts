import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

class InMemoryRateLimiter {
  private hits: Map<string, RateLimitRecord> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private message: string;

  constructor(windowMs: number, maxRequests: number, message: string) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message;

    // Periodic cleanup of stale entries every 2 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.hits.entries()) {
        record.timestamps = record.timestamps.filter(t => now - t < this.windowMs);
        if (record.timestamps.length === 0) {
          this.hits.delete(key);
        }
      }
    }, 120000).unref();
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Key by client IP address
      const ip = (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        '127.0.0.1'
      ).trim();

      const key = `${ip}:${req.baseUrl}${req.path}`;
      const now = Date.now();

      let record = this.hits.get(key);
      if (!record) {
        record = { timestamps: [] };
        this.hits.set(key, record);
      }

      // Evict entries older than window
      record.timestamps = record.timestamps.filter(t => now - t < this.windowMs);

      if (record.timestamps.length >= this.maxRequests) {
        const oldest = record.timestamps[0];
        const retryAfterSec = Math.ceil((this.windowMs - (now - oldest)) / 1000);

        res.setHeader('Retry-After', retryAfterSec.toString());
        res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');

        res.status(429).json({
          success: false,
          error: this.message,
          retryAfterSeconds: retryAfterSec
        });
        return;
      }

      record.timestamps.push(now);

      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (this.maxRequests - record.timestamps.length).toString());

      next();
    };
  }
}

/**
 * Authentication Rate Limiter:
 * 15 login attempts per 15 minutes per IP to block brute force credential guessing.
 */
export const authRateLimiter = new InMemoryRateLimiter(
  15 * 60 * 1000,
  15,
  'Too many login attempts. Access temporarily throttled. Please try again later.'
).middleware();

/**
 * Critical Operations Rate Limiter (Commands & Device Restart):
 * Max 30 critical operations per minute to prevent command flooding / physical equipment wear.
 */
export const criticalOpsRateLimiter = new InMemoryRateLimiter(
  60 * 1000,
  30,
  'Rate limit exceeded for machine commands. Please wait before issuing further commands.'
).middleware();

/**
 * General API Rate Limiter:
 * Max 600 requests per minute per IP for standard REST API endpoints.
 */
export const generalApiRateLimiter = new InMemoryRateLimiter(
  60 * 1000,
  600,
  'High request volume detected. Please reduce API polling frequency.'
).middleware();

/**
 * Health / Recovery Rate Limiter:
 * Max 5 recovery triggers per 5 minutes to prevent restart spamming.
 */
export const healthRecoveryRateLimiter = new InMemoryRateLimiter(
  5 * 60 * 1000,
  5,
  'Server self-recovery rate limit reached. Please wait before triggering another restart.'
).middleware();

