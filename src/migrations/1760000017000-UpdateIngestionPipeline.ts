import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateIngestionPipeline1760000017000 implements MigrationInterface {
  name = 'UpdateIngestionPipeline1760000017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create Enums
    await queryRunner.query(
      `CREATE TYPE "public"."ingestion_jobs_stage_enum" AS ENUM('queued', 'asset_validated', 'ocr_completed', 'extraction_completed', 'matches_proposed', 'needs_review', 'completed')`,
    );

    // 2. Extend IngestionJob Table (without dropping existing data)
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "pipeline_version" character varying NOT NULL DEFAULT 'v1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "stage_enum" "public"."ingestion_jobs_stage_enum" NOT NULL DEFAULT 'queued'`,
    );
    // Move existing stage string to stage_enum if valid, or just keep default
    // We will drop the old 'stage' column and rename the new one, but let's first set it up
    await queryRunner.query(
      `UPDATE "ingestion_jobs" SET "stage_enum" = 'queued' WHERE "stage" IS NULL`,
    );
    // Since 'stage' was a string, let's just drop it and rename 'stage_enum' -> 'stage'
    await queryRunner.query(`ALTER TABLE "ingestion_jobs" DROP COLUMN "stage"`);
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" RENAME COLUMN "stage_enum" TO "stage"`,
    );

    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "attempt_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "max_attempts" integer NOT NULL DEFAULT 5`,
    );

    // We need to provide a unique idempotency_key for existing records.
    // We can use the job id for existing records to ensure uniqueness.
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "idempotency_key" character varying`,
    );
    await queryRunner.query(
      `UPDATE "ingestion_jobs" SET "idempotency_key" = "id" WHERE "idempotency_key" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ALTER COLUMN "idempotency_key" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "UQ_idempotency_key" UNIQUE ("idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_idempotency_key" ON "ingestion_jobs" ("idempotency_key")`,
    );

    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "task_name" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "lease_owner" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "lease_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "retryable" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "error_code" character varying`,
    );

    // Unique Constraint
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "UQ_concert_upload_id_pipeline_version" UNIQUE ("concert_upload_id", "pipeline_version")`,
    );

    // 3. Create IngestionCandidate Table
    await queryRunner.query(
      `CREATE TABLE "ingestion_candidates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ingestion_job_id" uuid NOT NULL,
        "candidate_index" integer NOT NULL DEFAULT 0,
        "provenance" jsonb,
        "suggested_venue_id" character varying,
        "suggested_band_ids" jsonb,
        "suggested_genre_ids" jsonb,
        "status" character varying NOT NULL DEFAULT 'pending',
        "published_concert_id" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ingestion_candidates" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_candidates" ADD CONSTRAINT "FK_ingestion_job_id" FOREIGN KEY ("ingestion_job_id") REFERENCES "ingestion_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // 4. Create IngestionOutbox Table
    await queryRunner.query(
      `CREATE TABLE "ingestion_outbox" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_id" uuid NOT NULL,
        "destination" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "retry_count" integer NOT NULL DEFAULT 0,
        "last_attempt_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ingestion_outbox" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 4. Drop IngestionOutbox Table
    await queryRunner.query(`DROP TABLE "ingestion_outbox"`);

    // 3. Drop IngestionCandidate Table
    await queryRunner.query(
      `ALTER TABLE "ingestion_candidates" DROP CONSTRAINT "FK_ingestion_job_id"`,
    );
    await queryRunner.query(`DROP TABLE "ingestion_candidates"`);

    // 2. Revert IngestionJob Table
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP CONSTRAINT "UQ_concert_upload_id_pipeline_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP COLUMN "error_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP COLUMN "retryable"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP COLUMN "lease_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP COLUMN "lease_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP COLUMN "task_name"`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_idempotency_key"`);
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP CONSTRAINT "UQ_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP COLUMN "idempotency_key"`,
    );

    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP COLUMN "max_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP COLUMN "attempt_count"`,
    );

    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD "stage_old" character varying`,
    );
    await queryRunner.query(
      `UPDATE "ingestion_jobs" SET "stage_old" = "stage"::text`,
    );
    await queryRunner.query(`ALTER TABLE "ingestion_jobs" DROP COLUMN "stage"`);
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" RENAME COLUMN "stage_old" TO "stage"`,
    );

    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" DROP COLUMN "pipeline_version"`,
    );

    // 1. Drop Enum
    await queryRunner.query(`DROP TYPE "public"."ingestion_jobs_stage_enum"`);
  }
}
