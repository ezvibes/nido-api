import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentOpsPersistence1760000024000 implements MigrationInterface {
  name = 'CreateAgentOpsPersistence1760000024000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "agent_key" varchar(64) NOT NULL,
        "workflow_id" varchar(128) NULL,
        "mission_key" varchar(128) NULL,
        "external_evidence_ref" varchar(255) NULL,
        "parent_run_id" uuid NULL,
        "initiated_by_user_id" integer NULL,
        "status" varchar(32) NOT NULL DEFAULT 'queued',
        "input_summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "output_summary" jsonb NULL,
        "terminal_error_category" varchar(64) NULL,
        "usage_totals" jsonb NULL,
        "started_at" timestamptz NULL,
        "completed_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_runs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agent_runs_parent_run" FOREIGN KEY ("parent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_agent_runs_initiated_by_user" FOREIGN KEY ("initiated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_agent_runs_status" CHECK ("status" IN ('queued', 'running', 'waiting_for_approval', 'succeeded', 'failed', 'cancelled'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_runs_agent_key_created_at"
      ON "agent_runs" ("agent_key", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_runs_status_created_at"
      ON "agent_runs" ("status", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_runs_mission_key"
      ON "agent_runs" ("mission_key")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_runs_parent_run_id"
      ON "agent_runs" ("parent_run_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_run_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "run_id" uuid NOT NULL,
        "sequence" integer NOT NULL,
        "event_type" varchar(48) NOT NULL,
        "message" text NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_run_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agent_run_events_run" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_agent_run_events_sequence_positive" CHECK ("sequence" >= 1),
        CONSTRAINT "CHK_agent_run_events_event_type" CHECK ("event_type" IN ('run_queued', 'run_started', 'step_progress', 'approval_requested', 'approval_resolved', 'run_succeeded', 'run_failed', 'run_cancelled'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_agent_run_events_run_id_sequence"
      ON "agent_run_events" ("run_id", "sequence")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_approval_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "run_id" uuid NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'pending',
        "output_type" varchar(48) NOT NULL,
        "title" varchar(255) NOT NULL,
        "summary" text NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "decided_by_user_id" integer NULL,
        "decision_note" text NULL,
        "decided_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_approval_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agent_approval_requests_run" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_agent_approval_requests_decided_by_user" FOREIGN KEY ("decided_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_agent_approval_requests_status" CHECK ("status" IN ('pending', 'approved', 'revision_requested', 'rejected', 'cancelled')),
        CONSTRAINT "CHK_agent_approval_requests_output_type" CHECK ("output_type" IN ('weekly_content_brief', 'social_concept', 'newsletter_draft', 'venue_enrichment', 'ingestion_publication', 'other'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_approval_requests_run_id"
      ON "agent_approval_requests" ("run_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_approval_requests_status_created_at"
      ON "agent_approval_requests" ("status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_agent_approval_requests_status_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_agent_approval_requests_run_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_approval_requests"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_agent_run_events_run_id_sequence"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_run_events"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_agent_runs_parent_run_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_agent_runs_mission_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_agent_runs_status_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_agent_runs_agent_key_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_runs"`);
  }
}
