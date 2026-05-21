import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConcertSyncSchedules1760000003000
  implements MigrationInterface
{
  name = 'CreateConcertSyncSchedules1760000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "concert_sync_schedules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_id" integer,
        "calendar_id" character varying(255) NOT NULL,
        "status" character varying(40) NOT NULL DEFAULT 'active',
        "cadence_minutes" integer NOT NULL DEFAULT 60,
        "lookahead_days" integer NOT NULL DEFAULT 30,
        "refresh_top_picks" boolean NOT NULL DEFAULT true,
        "encrypted_refresh_token" text NOT NULL,
        "gemini_prompt" text,
        "gemini_context" text,
        "next_run_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "run_started_at" TIMESTAMP WITH TIME ZONE,
        "last_run_at" TIMESTAMP WITH TIME ZONE,
        "last_job_id" uuid,
        "last_error" text,
        "schedule_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_concert_sync_schedules_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_sync_schedules_owner_id_user_id'
        ) THEN
          ALTER TABLE "concert_sync_schedules"
          ADD CONSTRAINT "FK_concert_sync_schedules_owner_id_user_id"
          FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_sync_schedules_last_job_id_job_id'
        ) THEN
          ALTER TABLE "concert_sync_schedules"
          ADD CONSTRAINT "FK_concert_sync_schedules_last_job_id_job_id"
          FOREIGN KEY ("last_job_id") REFERENCES "concert_sync_jobs"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concert_sync_schedules_owner_id" ON "concert_sync_schedules" ("owner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concert_sync_schedules_status_next_run" ON "concert_sync_schedules" ("status", "next_run_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_sync_schedules_status_next_run"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_sync_schedules_owner_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concert_sync_schedules" DROP CONSTRAINT IF EXISTS "FK_concert_sync_schedules_last_job_id_job_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concert_sync_schedules" DROP CONSTRAINT IF EXISTS "FK_concert_sync_schedules_owner_id_user_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "concert_sync_schedules"');
  }
}
