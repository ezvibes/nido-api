import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { traceContextStorage, TraceContext } from './trace-context.storage';

/**
 * Middleware that extracts Google Cloud Trace context from the incoming
 * `x-cloud-trace-context` header and binds it to the current asynchronous
 * execution context via AsyncLocalStorage.
 *
 * Header format: `TRACE_ID/SPAN_ID;o=TRACE_TRUE`
 * e.g. `105445aa7843bc8bf206b12000100000/1;o=1`
 */
@Injectable()
export class TraceContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawHeader = req.headers['x-cloud-trace-context'];
    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    let context: TraceContext = {};
    if (headerValue && typeof headerValue === 'string') {
      const match = headerValue.match(
        /^([a-f0-9]+)(?:\/([a-f0-9]+))?(?:;o=([01]))?$/i,
      );
      if (match) {
        context = {
          traceId: match[1],
          spanId: match[2],
        };
      }
    }

    traceContextStorage.run(context, () => next());
  }
}
