import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { GcpStructuredLogger } from './gcp-structured-logger.service';
import { TraceContextMiddleware } from './trace-context.middleware';

@Global()
@Module({
  providers: [GcpStructuredLogger],
  exports: [GcpStructuredLogger],
})
export class GcpLoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceContextMiddleware).forRoutes('*');
  }
}
