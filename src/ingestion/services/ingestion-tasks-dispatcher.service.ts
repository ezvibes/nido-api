import { CloudTasksClient } from '@google-cloud/tasks';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IngestionOutbox } from '../entities/ingestion-outbox.entity';

@Injectable()
export class IngestionTasksDispatcherService {
  private readonly logger = new Logger(IngestionTasksDispatcherService.name);
  private readonly tasksClient: CloudTasksClient | null = null;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(IngestionOutbox)
    private readonly outboxRepository: Repository<IngestionOutbox>,
  ) {
    const isEnabledStr = this.configService.get<string>('INGESTION_ASYNC_DISPATCH_ENABLED');
    this.enabled = isEnabledStr === 'true';

    if (this.enabled) {
      try {
        this.tasksClient = new CloudTasksClient();
      } catch (e) {
        this.logger.warn('Failed to initialize CloudTasksClient. Fallback will be used.', e);
      }
    }
  }

  async dispatchJob(jobId: string): Promise<void> {
    const queuePath = this.configService.get<string>('CLOUD_TASKS_QUEUE_PATH');
    const workerUrl = this.configService.get<string>('INGESTION_WORKER_URL');
    const serviceAccountEmail = this.configService.get<string>('CLOUD_TASKS_INVOKER_SA');

    if (!this.enabled || !this.tasksClient || !queuePath || !workerUrl || !serviceAccountEmail) {
      this.logger.log(`Async dispatch disabled or misconfigured. Intent to dispatch job ${jobId} to Cloud Tasks logged.`);
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const outbox = await manager.findOne(IngestionOutbox, {
        where: { jobId, status: 'pending' },
        lock: { mode: 'pessimistic_write' },
      });

      if (!outbox) {
        this.logger.log(`No pending outbox entry found for job ${jobId}`);
        return;
      }

      // Generate deterministic task name
      const taskName = `${queuePath}/tasks/job-${jobId}-attempt-${outbox.retryCount}`;
      const payload = { jobId };

      try {
        await this.tasksClient!.createTask({
          parent: queuePath,
          task: {
            name: taskName,
            httpRequest: {
              httpMethod: 'POST',
              url: workerUrl,
              oidcToken: {
                serviceAccountEmail,
                audience: workerUrl,
              },
              headers: {
                'Content-Type': 'application/json',
              },
              body: Buffer.from(JSON.stringify(payload)).toString('base64'),
            },
          },
        });

        outbox.status = 'dispatched';
        await manager.save(outbox);
        this.logger.log(`Successfully dispatched task ${taskName} for job ${jobId}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to dispatch task for job ${jobId}: ${errorMsg}`);
        outbox.retryCount += 1;
        outbox.lastAttemptAt = new Date();
        await manager.save(outbox);
      }
    });
  }
}
