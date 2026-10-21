import { GcpStructuredLogger } from './gcp-structured-logger.service';
import { traceContextStorage } from './trace-context.storage';

describe('GcpStructuredLogger', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      LOG_FORMAT: 'json',
    };
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.env = { ...originalEnv };
  });

  function getLastWrittenJson(spy: jest.SpyInstance) {
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall).toBeDefined();
    return JSON.parse(lastCall[0] as string);
  }

  describe('Severity Mapping in Production', () => {
    it('should format log() as single-line JSON with severity: INFO to stdout', () => {
      const logger = new GcpStructuredLogger('TestContext');
      logger.log('Concert sync started');

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).not.toHaveBeenCalled();

      const json = getLastWrittenJson(stdoutSpy);
      expect(json.severity).toBe('INFO');
      expect(json.message).toBe('Concert sync started');
      expect(json.context).toBe('TestContext');
      expect(json.timestamp).toBeDefined();
      expect(json.serviceContext).toBeDefined();
      expect(json.serviceContext.service).toBe('nido-api');
    });

    it('should format warn() as severity: WARNING to stdout', () => {
      const logger = new GcpStructuredLogger('TestContext');
      logger.warn('Ticket URL returned 301 redirect');

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      const json = getLastWrittenJson(stdoutSpy);
      expect(json.severity).toBe('WARNING');
      expect(json.message).toBe('Ticket URL returned 301 redirect');
    });

    it('should format debug() and verbose() as severity: DEBUG to stdout', () => {
      const logger = new GcpStructuredLogger('TestContext');
      logger.debug('Evaluating ReAct iteration 2');
      logger.verbose('Verbose details');

      expect(stdoutSpy).toHaveBeenCalledTimes(2);
      const firstJson = JSON.parse(stdoutSpy.mock.calls[0][0]);
      const secondJson = JSON.parse(stdoutSpy.mock.calls[1][0]);

      expect(firstJson.severity).toBe('DEBUG');
      expect(firstJson.message).toBe('Evaluating ReAct iteration 2');
      expect(secondJson.severity).toBe('DEBUG');
      expect(secondJson.message).toBe('Verbose details');
    });

    it('should format error() with stack trace as severity: ERROR to stderr', () => {
      const logger = new GcpStructuredLogger('TestContext');
      const fakeStack =
        'Error: Connection timeout\n    at Database.connect (/src/db.ts:42:15)';
      logger.error('Database query timed out', fakeStack);

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy).not.toHaveBeenCalled();

      const json = getLastWrittenJson(stderrSpy);
      expect(json.severity).toBe('ERROR');
      expect(json.message).toContain('Database query timed out');
      expect(json.message).toContain(fakeStack);
      expect(json.stack_trace).toBe(fakeStack);
      expect(json.serviceContext).toBeDefined();
    });

    it('should format error() when an Error instance is passed', () => {
      const logger = new GcpStructuredLogger('TestContext');
      const err = new Error('Cloud SQL unreachable');
      logger.error(err);

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      const json = getLastWrittenJson(stderrSpy);
      expect(json.severity).toBe('ERROR');
      expect(json.message).toContain('Cloud SQL unreachable');
      expect(json.stack_trace).toBeDefined();
    });
  });

  describe('Google Cloud Trace Correlation', () => {
    it('should inject logging.googleapis.com/trace and spanId when traceContextStorage is active', () => {
      process.env.GOOGLE_CLOUD_PROJECT = 'nido-api-9ed65';
      const logger = new GcpStructuredLogger('FirenzeEditorialAgent');

      traceContextStorage.run(
        {
          traceId: 'c735d472b534438b8ff75949d0124f92',
          spanId: '000000000000004a',
        },
        () => {
          logger.log('Firenze staged draft');
        },
      );

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      const json = getLastWrittenJson(stdoutSpy);
      expect(json['logging.googleapis.com/trace']).toBe(
        'projects/nido-api-9ed65/traces/c735d472b534438b8ff75949d0124f92',
      );
      expect(json['logging.googleapis.com/spanId']).toBe('000000000000004a');
    });

    it('should omit trace metadata when no trace context is active', () => {
      const logger = new GcpStructuredLogger('Worker');
      logger.log('Background task running outside HTTP request');

      const json = getLastWrittenJson(stdoutSpy);
      expect(json['logging.googleapis.com/trace']).toBeUndefined();
      expect(json['logging.googleapis.com/spanId']).toBeUndefined();
    });
  });

  describe('Structured Metadata Payloads', () => {
    it('should serialize object messages and preserve extra metadata properties', () => {
      const logger = new GcpStructuredLogger('AgentRunner');
      logger.log(
        {
          message: 'Agent turn completed',
          agent: 'Firenze',
          turn: 3,
          toolsCalled: ['fetchApprovedConcerts', 'verifyTicketUrl'],
        },
        'FirenzeRunner',
      );

      const json = getLastWrittenJson(stdoutSpy);
      expect(json.severity).toBe('INFO');
      expect(json.message).toBe('Agent turn completed');
      expect(json.context).toBe('FirenzeRunner');
      expect(json.agent).toBe('Firenze');
      expect(json.turn).toBe(3);
      expect(json.toolsCalled).toEqual([
        'fetchApprovedConcerts',
        'verifyTicketUrl',
      ]);
    });
  });

  describe('Development Mode Fallback', () => {
    it('should delegate to super console logger in development mode when LOG_FORMAT is not json', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_FORMAT;

      const logger = new GcpStructuredLogger('DevContext');
      // In ConsoleLogger, printMessages or write uses stdout directly or process.stdout
      // Test that it does not output structured JSON
      logger.log('Dev test message');

      // Check that stdout output does not parse as single-line JSON with severity property
      if (stdoutSpy.mock.calls.length > 0) {
        const rawOutput = stdoutSpy.mock.calls[0][0] as string;
        try {
          const parsed = JSON.parse(rawOutput);
          expect(parsed.severity).toBeUndefined();
        } catch {
          // Expected: Not JSON formatted
          expect(true).toBe(true);
        }
      }
    });
  });

  describe('NestJS DI & Logger Delegation Compatibility', () => {
    it('should resolve via moduleRef.get(GcpStructuredLogger) without throwing InvalidClassScopeException', async () => {
      const { Test } = await import('@nestjs/testing');
      const { GcpLoggingModule } = await import('./gcp-logging.module');
      const moduleRef = await Test.createTestingModule({
        imports: [GcpLoggingModule],
      }).compile();

      const logger = moduleRef.get(GcpStructuredLogger);
      expect(logger).toBeInstanceOf(GcpStructuredLogger);
    });

    it('should treat 2nd argument in error(message, context) as context when called via NestJS Logger without stack', () => {
      const logger = new GcpStructuredLogger();
      logger.error('Beehiiv API returned 429', 'BeehiivService');

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      const json = getLastWrittenJson(stderrSpy);
      expect(json.severity).toBe('ERROR');
      expect(json.message).toBe('Beehiiv API returned 429');
      expect(json.context).toBe('BeehiivService');
      expect(json.stack_trace).toBeUndefined();
    });

    it('should format fatal() as severity: CRITICAL to stderr', () => {
      const logger = new GcpStructuredLogger('Bootstrap');
      logger.fatal('Unrecoverable database initialization failure');

      expect(stderrSpy).toHaveBeenCalledTimes(1);
      const json = getLastWrittenJson(stderrSpy);
      expect(json.severity).toBe('CRITICAL');
      expect(json.message).toBe(
        'Unrecoverable database initialization failure',
      );
      expect(json.context).toBe('Bootstrap');
    });
  });

  describe('Circular Reference & BigInt Resilience', () => {
    it('should safely serialize objects with circular references without throwing', () => {
      const logger = new GcpStructuredLogger('HttpFilter');
      const circularPayload: Record<string, unknown> = {
        message: 'Upstream request failed',
        statusCode: 502,
      };
      circularPayload.self = circularPayload;

      expect(() => logger.log(circularPayload)).not.toThrow();

      const json = getLastWrittenJson(stdoutSpy);
      expect(json.severity).toBe('INFO');
      expect(json.message).toBe('Upstream request failed');
      expect(json.statusCode).toBe(502);
      expect(json.self).toBe('[Circular]');
    });

    it('should safely serialize BigInt values inside structured log metadata', () => {
      const logger = new GcpStructuredLogger('Metrics');
      expect(() =>
        logger.log({
          message: 'Processed batch',
          durationNs: BigInt('9007199254740993'),
        }),
      ).not.toThrow();

      const json = getLastWrittenJson(stdoutSpy);
      expect(json.durationNs).toBe('9007199254740993');
    });
  });
});
