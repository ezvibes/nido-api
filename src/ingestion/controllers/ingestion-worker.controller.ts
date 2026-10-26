import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleOidcGuard } from '../../auth/guards/google-oidc.guard';
import { IngestionStateMachineService } from '../services/ingestion-state-machine.service';
import { IngestionService } from '../ingestion.service';
import { IngestionTasksDispatcherService } from '../services/ingestion-tasks-dispatcher.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IngestionJob } from '../entities/ingestion-job.entity';
import {
  IngestionStage,
  IngestionTerminalStatus,
} from '../interfaces/ingestion-enums';

interface WorkerPayload {
  jobId: string;
}

@Controller('internal/ingestion')
export class IngestionWorkerController {
  private readonly logger = new Logger(IngestionWorkerController.name);
  private readonly LEASE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

  constructor(
    private readonly stateMachine: IngestionStateMachineService,
    private readonly ingestionService: IngestionService,
    private readonly tasksDispatcher: IngestionTasksDispatcherService,
    @InjectRepository(IngestionJob)
    private readonly jobRepository: Repository<IngestionJob>,
  ) {}

  @Post('process-job')
  @UseGuards(GoogleOidcGuard)
  @HttpCode(HttpStatus.OK)
  async processJob(
    @Body() payload: WorkerPayload,
  ): Promise<{ success: boolean; skipped?: boolean }> {
    const { jobId } = payload;

    if (!jobId) {
      this.logger.warn('Received payload without jobId');
      return { success: true, skipped: true }; // ACK bad payload
    }

    try {
      const workerId = `worker-${Math.random().toString(36).substring(7)}`;
      const leaseClaimed = await this.stateMachine.claimJob(
        jobId,
        workerId,
        this.LEASE_DURATION_MS,
      );

      if (!leaseClaimed) {
        const job = await this.jobRepository.findOne({ where: { id: jobId } });
        if (!job) {
          this.logger.warn(`Job ${jobId} not found during lease check`);
          return { success: true, skipped: true }; // Terminal: job deleted
        }

        const isTerminalStatus = Object.values(
          IngestionTerminalStatus,
        ).includes(job.status as IngestionTerminalStatus);
        const isPastStage = [
          IngestionStage.EXTRACTION_COMPLETED,
          IngestionStage.MATCHES_PROPOSED,
          IngestionStage.NEEDS_REVIEW,
          IngestionStage.COMPLETED,
        ].includes(job.stage);

        if (isTerminalStatus || isPastStage) {
          this.logger.log(
            `Job ${jobId} already past extraction or terminal (${job.stage}/${job.status}). Acknowledging duplicate task.`,
          );
          return { success: true, skipped: true }; // Safe ACK for terminal duplicate
        }

        // Active lease contention / in-flight worker: do NOT acknowledge! Return 503 so Cloud Tasks retries.
        this.logger.warn(
          `Job ${jobId} lease currently held by ${job.leaseOwner} until ${job.leaseExpiresAt}. Triggering retry backoff.`,
        );
        throw new ServiceUnavailableException(
          `Job ${jobId} lease currently held by another worker. Retry scheduled.`,
        );
      }

      // Execute extraction pipeline (rethrows on failure)
      await this.ingestionService.runExtractionPipeline(jobId);

      return { success: true };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error processing job ${jobId}: ${msg}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Terminal errors: missing source files or deleted entities
      if (msg.includes('not found') || msg.includes('Invalid')) {
        await this.markJobTerminal(jobId, msg);
        return { success: true, skipped: true }; // ACK terminal failure to prevent useless retries
      }

      // Transient / retryable errors: throw 500 to trigger Cloud Tasks exponential backoff retry
      throw new InternalServerErrorException(
        `Transient error processing job ${jobId}: ${msg}`,
      );
    }
  }

  @Post('redrive-outbox')
  @UseGuards(GoogleOidcGuard)
  @HttpCode(HttpStatus.OK)
  async redriveOutbox(): Promise<{ redrivenCount: number }> {
    const count = await this.tasksDispatcher.redrivePendingOutbox();
    return { redrivenCount: count };
  }

  private async markJobTerminal(jobId: string, errorMsg: string) {
    try {
      await this.jobRepository.update(jobId, {
        status: IngestionTerminalStatus.TERMINAL_FAILURE,
        errorMessage: errorMsg,
      });
    } catch (e) {
      this.logger.error(`Failed to mark job ${jobId} as terminal`, e);
    }
  }
}
