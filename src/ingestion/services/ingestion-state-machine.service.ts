import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, UpdateResult } from 'typeorm';
import { IngestionJob } from '../entities/ingestion-job.entity';
import {
  IngestionStage,
  IngestionTerminalStatus,
} from '../interfaces/ingestion-enums';
import { IngestionOutbox } from '../entities/ingestion-outbox.entity';
import { IngestionCandidate } from '../entities/ingestion-candidate.entity';

@Injectable()
export class IngestionStateMachineService {
  private readonly logger = new Logger(IngestionStateMachineService.name);

  // Define valid linear progression
  private static readonly STAGE_ORDER: Record<IngestionStage, number> = {
    [IngestionStage.QUEUED]: 0,
    [IngestionStage.ASSET_VALIDATED]: 1,
    [IngestionStage.OCR_COMPLETED]: 2,
    [IngestionStage.EXTRACTION_COMPLETED]: 3,
    [IngestionStage.MATCHES_PROPOSED]: 4,
    [IngestionStage.NEEDS_REVIEW]: 5,
    [IngestionStage.COMPLETED]: 6,
  };

  constructor(
    @InjectRepository(IngestionJob)
    private readonly jobRepository: Repository<IngestionJob>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Validates and applies a stage transition.
   * Duplicate delivery / terminal stage handling: Returns false if the stage is already at or past the target stage.
   * Throws an error for invalid transitions (e.g. moving backwards, though we handle idempotency by just returning false).
   */
  async transitionTo(
    jobId: string,
    targetStage: IngestionStage,
  ): Promise<boolean> {
    const result = await this.dataSource.transaction(async (manager) => {
      const job = await manager.findOne(IngestionJob, {
        where: { id: jobId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Check if job is already in a terminal status.
      // Assuming status contains terminal values. If job.status is in IngestionTerminalStatus, do not transition.
      if (
        Object.values(IngestionTerminalStatus).includes(
          job.status as IngestionTerminalStatus,
        )
      ) {
        return false;
      }

      const currentOrder = IngestionStateMachineService.STAGE_ORDER[job.stage];
      const targetOrder = IngestionStateMachineService.STAGE_ORDER[targetStage];

      if (currentOrder >= targetOrder) {
        // Idempotency: Duplicate delivery or already past this stage
        return false;
      }

      // Allow transition
      job.stage = targetStage;
      job.status = targetStage; // We are keeping status and stage aligned for now, or status could just reflect "processing" vs "completed"
      await manager.save(job);
      return true;
    });

    return result;
  }

  /**
   * Atomic lease claiming method: uses compare-and-set (optimistic concurrency with specific constraints)
   * or row-lock via UpdateQueryBuilder.
   */
  async claimJob(
    jobId: string,
    workerId: string,
    leaseDurationMs: number,
  ): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseDurationMs);

    const result: UpdateResult = await this.jobRepository
      .createQueryBuilder()
      .update(IngestionJob)
      .set({
        leaseOwner: workerId,
        leaseExpiresAt: expiresAt,
      })
      .where('id = :jobId', { jobId })
      .andWhere('(lease_owner IS NULL OR lease_expires_at < :now)', { now })
      .execute();

    return result.affected === 1;
  }

  /**
   * Dispatches a task by creating an outbox record transactionally.
   */
  async dispatchTask(
    jobId: string,
    destination: string,
    payload: Record<string, any>,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const outbox = manager.create(IngestionOutbox, {
        jobId,
        destination,
        payload,
      });
      await manager.save(outbox);
    });
  }

  async persistCandidates(
    jobId: string,
    candidatesData: Partial<IngestionCandidate>[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const job = await manager.findOne(IngestionJob, {
        where: { id: jobId },
      });

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const candidates = candidatesData.map((data) =>
        manager.create(IngestionCandidate, { ...data, ingestionJobId: jobId }),
      );

      await manager.save(candidates);
    });
  }
}
