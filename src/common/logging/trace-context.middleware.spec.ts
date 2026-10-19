import { TraceContextMiddleware } from './trace-context.middleware';
import { traceContextStorage } from './trace-context.storage';
import type { Request, Response } from 'express';

describe('TraceContextMiddleware', () => {
  let middleware: TraceContextMiddleware;

  beforeEach(() => {
    middleware = new TraceContextMiddleware();
  });

  it('should parse valid X-Cloud-Trace-Context header and set AsyncLocalStorage context', (done) => {
    const req = {
      headers: {
        'x-cloud-trace-context': '105445aa7843bc8bf206b12000100000/12345;o=1',
      },
    } as unknown as Request;
    const res = {} as Response;

    middleware.use(req, res, () => {
      const store = traceContextStorage.getStore();
      expect(store).toBeDefined();
      expect(store?.traceId).toBe('105445aa7843bc8bf206b12000100000');
      expect(store?.spanId).toBe('12345');
      done();
    });
  });

  it('should parse trace ID without span ID', (done) => {
    const req = {
      headers: {
        'x-cloud-trace-context': 'abcdef1234567890abcdef1234567890',
      },
    } as unknown as Request;
    const res = {} as Response;

    middleware.use(req, res, () => {
      const store = traceContextStorage.getStore();
      expect(store).toBeDefined();
      expect(store?.traceId).toBe('abcdef1234567890abcdef1234567890');
      expect(store?.spanId).toBeUndefined();
      done();
    });
  });

  it('should handle missing header gracefully with empty store', (done) => {
    const req = {
      headers: {},
    } as unknown as Request;
    const res = {} as Response;

    middleware.use(req, res, () => {
      const store = traceContextStorage.getStore();
      expect(store).toBeDefined();
      expect(store?.traceId).toBeUndefined();
      expect(store?.spanId).toBeUndefined();
      done();
    });
  });
});
