import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceContext {
  traceId?: string;
  spanId?: string;
}

export const traceContextStorage = new AsyncLocalStorage<TraceContext>();
