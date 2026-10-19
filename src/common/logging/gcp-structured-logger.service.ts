import { ConsoleLogger, Injectable, Optional } from '@nestjs/common';
import { traceContextStorage } from './trace-context.storage';

export type GcpLogSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'NOTICE'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL'
  | 'ALERT'
  | 'EMERGENCY';

export interface GcpLogEntry {
  severity: GcpLogSeverity;
  message: string;
  context?: string;
  timestamp: string;
  'logging.googleapis.com/trace'?: string;
  'logging.googleapis.com/spanId'?: string;
  '@type'?: string;
  serviceContext?: {
    service: string;
    version: string;
  };
  stack_trace?: string;
  [key: string]: unknown;
}

/**
 * Safely serializes any value to single-line JSON, replacing circular
 * references with `"[Circular]"` and converting `BigInt` values to strings.
 */
export function safeStringify(value: unknown, rootAlias?: unknown): string {
  const ancestors: unknown[] = [];
  try {
    return JSON.stringify(value, function (this: unknown, _key: string, val: unknown): unknown {
      if (typeof val === 'bigint') {
        return val.toString();
      }
      if (typeof val !== 'object' || val === null) {
        return val;
      }
      // Pop ancestors that are no longer in the current property path
      while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
        ancestors.pop();
      }
      if (ancestors.includes(val) || (ancestors.length > 0 && rootAlias !== undefined && val === rootAlias)) {
        return '[Circular]';
      }
      ancestors.push(val);
      if (val instanceof Error) {
        return {
          name: val.name,
          message: val.message,
          stack: val.stack,
        };
      }
      return val;
    });
  } catch {
    return JSON.stringify({
      severity: 'ERROR',
      message: '[Unserializable log payload]',
      timestamp: new Date().toISOString(),
    });
  }
}

@Injectable()
export class GcpStructuredLogger extends ConsoleLogger {
  private readonly isProduction: boolean;
  private readonly projectId: string;
  private readonly serviceName: string;
  private readonly serviceVersion: string;

  constructor(@Optional() context?: string) {
    super(context ?? '');
    this.isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.LOG_FORMAT === 'json';
    this.projectId =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      process.env.PROJECT_ID ||
      'nido-api-9ed65';
    this.serviceName = process.env.K_SERVICE || 'nido-api';
    this.serviceVersion = process.env.K_REVISION || 'dev';
  }

  override log(message: unknown, context?: string): void {
    if (!this.isProduction) {
      if (context !== undefined) {
        super.log(message, context);
      } else {
        super.log(message);
      }
      return;
    }
    this.emitGcpLog('INFO', message, context);
  }

  override warn(message: unknown, context?: string): void {
    if (!this.isProduction) {
      if (context !== undefined) {
        super.warn(message, context);
      } else {
        super.warn(message);
      }
      return;
    }
    this.emitGcpLog('WARNING', message, context);
  }

  override error(message: unknown, stackOrContext?: string, context?: string): void {
    if (!this.isProduction) {
      if (context !== undefined) {
        super.error(message, stackOrContext, context);
      } else if (stackOrContext !== undefined) {
        super.error(message, stackOrContext);
      } else {
        super.error(message);
      }
      return;
    }

    let resolvedStack: string | undefined;
    let resolvedContext: string | undefined;

    if (context !== undefined) {
      resolvedStack = stackOrContext;
      resolvedContext = context;
    } else if (stackOrContext !== undefined) {
      if (this.isStackLike(stackOrContext)) {
        resolvedStack = stackOrContext;
      } else {
        resolvedContext = stackOrContext;
      }
    }

    this.emitGcpLog('ERROR', message, resolvedContext, resolvedStack);
  }

  override fatal(message: unknown, context?: string): void {
    if (!this.isProduction) {
      if (context !== undefined) {
        super.fatal(message, context);
      } else {
        super.fatal(message);
      }
      return;
    }
    this.emitGcpLog('CRITICAL', message, context);
  }

  override debug(message: unknown, context?: string): void {
    if (!this.isProduction) {
      if (context !== undefined) {
        super.debug(message, context);
      } else {
        super.debug(message);
      }
      return;
    }
    this.emitGcpLog('DEBUG', message, context);
  }

  override verbose(message: unknown, context?: string): void {
    if (!this.isProduction) {
      if (context !== undefined) {
        super.verbose(message, context);
      } else {
        super.verbose(message);
      }
      return;
    }
    this.emitGcpLog('DEBUG', message, context);
  }

  private isStackLike(value: string): boolean {
    return value.includes('\n') || /^(Error|TypeError|ReferenceError|SyntaxError|RangeError):/.test(value);
  }

  /**
   * Internal formatter emitting single-line JSON adhering to GCP structured logging specification.
   */
  private emitGcpLog(
    severity: GcpLogSeverity,
    message: unknown,
    contextOverride?: string,
    stack?: string,
  ): void {
    const context = contextOverride || this.context || undefined;
    const timestamp = new Date().toISOString();

    let formattedMessage = '';
    let additionalProps: Record<string, unknown> = {};

    if (typeof message === 'string') {
      formattedMessage = message;
    } else if (message instanceof Error) {
      formattedMessage = message.message;
      stack = stack || message.stack;
    } else if (typeof message === 'object' && message !== null) {
      const { msg, message: objMsg, ...rest } = message as Record<string, unknown>;
      formattedMessage =
        typeof msg === 'string'
          ? msg
          : typeof objMsg === 'string'
            ? objMsg
            : safeStringify(message);
      additionalProps = rest;
    } else {
      formattedMessage = String(message);
    }

    const entry: GcpLogEntry = {
      ...additionalProps,
      severity,
      message: formattedMessage,
      context,
      timestamp,
      serviceContext: {
        service: this.serviceName,
        version: this.serviceVersion,
      },
    };

    // Attach error stack trace if available (required for GCP Error Reporting automatic grouping)
    if (stack) {
      entry.stack_trace = stack;
      if (severity === 'ERROR' || severity === 'CRITICAL') {
        entry['@type'] =
          'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';
      }
      // In GCP Error Reporting, if message doesn't contain stack, appending stack ensures grouping
      if (!entry.message.includes(stack)) {
        entry.message = `${entry.message}\n${stack}`;
      }
    }

    // Attach Google Cloud Trace context if active in the current AsyncLocalStorage execution context
    const traceContext = traceContextStorage.getStore();
    if (traceContext?.traceId) {
      entry['logging.googleapis.com/trace'] = `projects/${this.projectId}/traces/${traceContext.traceId}`;
      if (traceContext.spanId) {
        entry['logging.googleapis.com/spanId'] = traceContext.spanId;
      }
    }

    const rootAlias = typeof message === 'object' && message !== null ? message : undefined;
    const jsonLine = safeStringify(entry, rootAlias) + '\n';
    if (severity === 'ERROR' || severity === 'CRITICAL') {
      process.stderr.write(jsonLine);
    } else {
      process.stdout.write(jsonLine);
    }
  }
}
