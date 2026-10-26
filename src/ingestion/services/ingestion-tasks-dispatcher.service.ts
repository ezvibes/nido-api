import { CloudTasksClient } from '@google-cloud/tasks';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
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

  isAsyncDispatchEnabled(): boolean {
    const queuePath = this.configService.get<string>('CLOUD_TASKS_QUEUE_PATH');
    const workerUrl = this.configService.get<string>('INGESTION_WORKER_URL');
    const serviceAccountEmail = this.configService.get<string>('CLOUD_TASKS_INVOKER_SA');
    return !!(this.enabled && this.tasksClient && queuePath && workerUrl && serviceAccountEmail);
  }

  /**
   * Dispatches a pending job to Cloud Tasks.
   * Performs the network request OUTSIDE the PostgreSQL write lock.
   * Uses a stable, deterministic task name per job and treats ALREADY_EXISTS as success.
   * Returns true if async dispatch was initiated, false if disabled/misconfigured.
   */
  async dispatchJob(jobId: string): Promise<boolean> {
    const queuePath = this.configService.get<string>('CLOUD_TASKS_QUEUE_PATH');
    const workerUrl = this.configService.get<string>('INGESTION_WORKER_URL');
    const serviceAccountEmail = this.configService.get<string>('CLOUD_TASKS_INVOKER_SA');
    const workerAudience =
      this.configService.get<string>('INGESTION_WORKER_AUDIENCE') ||
      workerUrl?.replace(/\/internal\/.*$/, '');

    if (!this.enabled || !this.tasksClient || !queuePath || !workerUrl || !serviceAccountEmail || !workerAudience) {
      this.logger.log(`Async dispatch disabled or misconfigured. Intent to dispatch job ${jobId} to Cloud Tasks logged.`);
      return false;
    }

    // Step 1: Find pending outbox entry without long-lived write lock across network
    const outbox = await this.outboxRepository.findOne({
      where: { jobId, status: 'pending' },
    });

    if (!outbox) {
      this.logger.log(`No pending outbox entry found for job ${jobId}`);
      return false;
    }

    // Step 2: Generate stable, deterministic task name (without retryCount)
    const taskName = `${queuePath}/tasks/job-${jobId}`;
    const payload = { jobId };

    let dispatchSuccess = false;

    // Step 3: Network call executed OUTSIDE any database transaction
    try {
      await this.tasksClient.createTask({
        parent: queuePath,
        task: {
          name: taskName,
          httpRequest: {
            httpMethod: 'POST',
            url: workerUrl,
            oidcToken: {
              serviceAccountEmail,
              audience: workerAudience,
            },
            headers: {
              'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
          },
        },
      });
      dispatchSuccess = true;
      this.logger.log(`Successfully dispatched task ${taskName} for job ${jobId}`);
    } catch (error: any) {
      // Cloud Tasks gRPC code 6 is ALREADY_EXISTS. Treat as successful deduplication!
      if (error?.code === 6 || error?.message?.includes('ALREADY_EXISTS')) {
        this.logger.log(`Task ${taskName} already exists in queue. Treating as successfully dispatched.`);
        dispatchSuccess = true;
      } else {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to dispatch task for job ${jobId}: ${errorMsg}`);
      }
    }

    // Step 4: Update outbox state based on dispatch result
    if (dispatchSuccess) {
      await this.outboxRepository.update(outbox.id, {
        status: 'dispatched',
        lastAttemptAt: new Date(),
      });
    } else {
      const nextRetryCount = outbox.retryCount + 1;
      await this.outboxRepository.update(outbox.id, {
        retryCount: nextRetryCount,
        lastAttemptAt: new Date(),
        status: nextRetryCount >= 5 ? 'failed' : 'pending',
      });
    }

    return dispatchSuccess;
  }

  /**
   * Scans and redrives pending outbox entries that have not yet been dispatched.
   */
  async redrivePendingOutbox(limit = 50): Promise<number> {
    if (!this.isAsyncDispatchEnabled()) {
      return 0;
    }

    const pendingEntries = await this.outboxRepository.find({
      where: {
        status: 'pending',
        retryCount: LessThan(5),
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    let redrivenCount = 0;
    for (const entry of pendingEntries) {
      const success = await this.dispatchJob(entry.jobId);
      if (success) {
        redrivenCount++;
      }
    }

    return redrivenCount;
  }
}
