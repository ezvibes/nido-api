import { Controller, Post, Body, UseGuards, Logger, HttpCode, HttpStatus, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { GoogleOidcGuard } from '../../auth/guards/google-oidc.guard';
import { IngestionStateMachineService } from '../services/ingestion-state-machine.service';
import { IngestionService } from '../ingestion.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IngestionJob } from '../entities/ingestion-job.entity';
import { IngestionTerminalStatus } from '../interfaces/ingestion-enums';

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
    @InjectRepository(IngestionJob)
    private readonly jobRepository: Repository<IngestionJob>,
  ) {}

  @Post('process-job')
  @UseGuards(GoogleOidcGuard)
  @HttpCode(HttpStatus.OK)
  async processJob(@Body() payload: WorkerPayload): Promise<{ success: boolean; skipped?: boolean }> {
    const { jobId } = payload;

    if (!jobId) {
      this.logger.warn('Received payload without jobId');
      return { success: true, skipped: true }; // ACK bad payload
    }

    try {
      const jobPre = await this.jobRepository.findOne({ where: { id: jobId } });
      if (!jobPre) {
         this.logger.warn(`Job ${jobId} not found, acking task.`);
         return { success: true, skipped: true };
      }

      if (Object.values(IngestionTerminalStatus).includes(jobPre.status as IngestionTerminalStatus) || jobPre.status === 'completed') {
         this.logger.log(`Skipping job ${jobId}, already in terminal state ${jobPre.status}.`);
         return { success: true, skipped: true };
      }

      const workerId = `worker-${Math.random().toString(36).substring(7)}`;
      const leaseClaimed = await this.stateMachine.claimJob(jobId, workerId, this.LEASE_DURATION_MS);

      if (!leaseClaimed) {
        this.logger.log(`Job ${jobId} lease is busy, triggering retry.`);
        throw new ServiceUnavailableException(`Lease busy for job ${jobId}`);
      }

      try {
        await this.ingestionService.runExtractionPipeline(jobId);

        // Check job status to see if it hit a retryable error internally
        const jobPost = await this.jobRepository.findOne({ where: { id: jobId } });
        if (jobPost && jobPost.status === IngestionTerminalStatus.RETRYABLE_FAILURE) {
          throw new Error('Internal retryable error');
        }

        return { success: true };
      } catch (pipelineError) {
        // Release lease on error so next retry can pick it up immediately
        await this.jobRepository.update(jobId, { leaseOwner: null, leaseExpiresAt: null });
        throw pipelineError; // propagate to outer catch
      }
    } catch (error: any) {
      if (error instanceof ServiceUnavailableException || error.status === 503) {
         throw error;
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing job ${jobId}: ${msg}`, error instanceof Error ? error.stack : undefined);

      // Attempt to determine if error is terminal. For this task, we will mark
      // known missing items as terminal.
      if (msg.includes('not found') || msg.includes('Invalid')) {
         await this.markJobTerminal(jobId, msg);
         return { success: true, skipped: true }; // ACK to prevent retry
      }

      // Propagate error to trigger Cloud Tasks retry
      throw new InternalServerErrorException(`Transient error processing job ${jobId}: ${msg}`);
    }
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
