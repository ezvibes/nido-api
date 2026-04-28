import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IngestionWorkerRunner } from './ingestion/worker/ingestion-worker.runner';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const runner = app.get(IngestionWorkerRunner);
    await runner.run();
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  const logger = new Logger('IngestionWorkerBootstrap');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
