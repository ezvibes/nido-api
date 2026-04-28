import { Injectable, Logger } from '@nestjs/common';
import { IngestionWorkerService } from './ingestion-worker.service';

@Injectable()
export class IngestionWorkerRunner {
  private readonly logger = new Logger(IngestionWorkerRunner.name);

  constructor(private readonly ingestionWorkerService: IngestionWorkerService) {}

  async run(): Promise<void> {
    const pollIntervalMs = Number(
      process.env.INGESTION_WORKER_POLL_INTERVAL_MS ?? '5000',
    );
    const runOnce = ['1', 'true', 'yes'].includes(
      String(process.env.INGESTION_WORKER_ONCE ?? '').toLowerCase(),
    );

    this.logger.log(
      runOnce
        ? 'Starting ingestion worker in one-shot mode'
        : `Starting ingestion worker loop (poll every ${pollIntervalMs}ms)`,
    );

    do {
      const result = await this.ingestionWorkerService.processNextQueuedJob();

      if (!result && runOnce) {
        this.logger.log('No queued ingestion jobs found.');
        return;
      }

      if (runOnce) {
        this.logger.log(
          result
            ? `Processed ingestion job ${result.jobId} with status ${result.status}`
            : 'No queued ingestion jobs found.',
        );
        return;
      }

      if (!result) {
        await this.sleep(pollIntervalMs);
      }
    } while (true);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
