import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';
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
  serviceContext?: {
    service: string;
    version: string;
  };
  stack_trace?: string;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.TRANSIENT })
export class GcpStructuredLogger extends ConsoleLogger {
  private readonly isProduction: boolean;
  private readonly projectId: string;
  private readonly serviceName: string;
  private readonly serviceVersion: string;

  constructor(context?: string) {
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
      super.log(message, context);
      return;
    }
    this.emitGcpLog('INFO', message, context);
  }

  override warn(message: unknown, context?: string): void {
    if (!this.isProduction) {
      super.warn(message, context);
      return;
    }
    this.emitGcpLog('WARNING', message, context);
  }

  override error(message: unknown, stack?: string, context?: string): void {
    if (!this.isProduction) {
      super.error(message, stack, context);
      return;
    }
    this.emitGcpLog('ERROR', message, context, stack);
  }

  override debug(message: unknown, context?: string): void {
    if (!this.isProduction) {
      super.debug(message, context);
      return;
    }
    this.emitGcpLog('DEBUG', message, context);
  }

  override verbose(message: unknown, context?: string): void {
    if (!this.isProduction) {
      super.verbose(message, context);
      return;
    }
    this.emitGcpLog('DEBUG', message, context);
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
      formattedMessage = (typeof msg === 'string' ? msg : typeof objMsg === 'string' ? objMsg : JSON.stringify(message));
      additionalProps = rest;
    } else {
      formattedMessage = String(message);
    }

    const entry: GcpLogEntry = {
      severity,
      message: formattedMessage,
      context,
      timestamp,
      serviceContext: {
        service: this.serviceName,
        version: this.serviceVersion,
      },
      ...additionalProps,
    };

    // Attach error stack trace if available (required for GCP Error Reporting automatic grouping)
    if (stack) {
      entry.stack_trace = stack;
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

    const jsonLine = JSON.stringify(entry) + '\n';
    if (severity === 'ERROR' || severity === 'CRITICAL') {
      process.stderr.write(jsonLine);
    } else {
      process.stdout.write(jsonLine);
    }
  }
}
