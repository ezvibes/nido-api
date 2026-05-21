import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConcertSyncInfrastructure1760000002000 implements MigrationInterface {
  name = 'CreateConcertSyncInfrastructure1760000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "is_top_pick" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "top_pick_score" real
    `);

    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "top_pick_refreshed_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concerts_is_top_pick" ON "concerts" ("is_top_pick")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concerts_top_pick_score" ON "concerts" ("top_pick_score")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "concert_sync_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_id" integer,
        "calendar_id" character varying(255) NOT NULL,
        "calendar_timezone" character varying(120),
        "status" character varying(40) NOT NULL DEFAULT 'queued',
        "requested_range_start" TIMESTAMP WITH TIME ZONE,
        "requested_range_end" TIMESTAMP WITH TIME ZONE,
        "started_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "refresh_top_picks" boolean NOT NULL DEFAULT true,
        "total_events_fetched" integer NOT NULL DEFAULT 0,
        "events_processed" integer NOT NULL DEFAULT 0,
        "events_created" integer NOT NULL DEFAULT 0,
        "events_updated" integer NOT NULL DEFAULT 0,
        "events_skipped" integer NOT NULL DEFAULT 0,
        "error_message" text,
        "job_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_concert_sync_jobs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_sync_jobs_owner_id_user_id'
        ) THEN
          ALTER TABLE "concert_sync_jobs"
          ADD CONSTRAINT "FK_concert_sync_jobs_owner_id_user_id"
          FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concert_sync_jobs_owner_id" ON "concert_sync_jobs" ("owner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concert_sync_jobs_status" ON "concert_sync_jobs" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "concert_sync_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_id" integer,
        "concert_id" uuid,
        "last_job_id" uuid,
        "calendar_id" character varying(255) NOT NULL,
        "calendar_event_id" character varying(255) NOT NULL,
        "event_fingerprint" character varying(128) NOT NULL,
        "source_updated_at" TIMESTAMP WITH TIME ZONE,
        "last_synced_at" TIMESTAMP WITH TIME ZONE,
        "extraction_confidence" real,
        "needs_guidance" boolean NOT NULL DEFAULT false,
        "extraction_warnings" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "raw_event" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_concert_sync_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_concert_sync_event_owner_calendar_event" UNIQUE ("owner_id", "calendar_id", "calendar_event_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_sync_events_owner_id_user_id'
        ) THEN
          ALTER TABLE "concert_sync_events"
          ADD CONSTRAINT "FK_concert_sync_events_owner_id_user_id"
          FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_sync_events_concert_id_concerts_id'
        ) THEN
          ALTER TABLE "concert_sync_events"
          ADD CONSTRAINT "FK_concert_sync_events_concert_id_concerts_id"
          FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_sync_events_last_job_id_jobs_id'
        ) THEN
          ALTER TABLE "concert_sync_events"
          ADD CONSTRAINT "FK_concert_sync_events_last_job_id_jobs_id"
          FOREIGN KEY ("last_job_id") REFERENCES "concert_sync_jobs"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concert_sync_events_owner_id" ON "concert_sync_events" ("owner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concert_sync_events_calendar" ON "concert_sync_events" ("calendar_id", "calendar_event_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concert_sync_events_last_job_id" ON "concert_sync_events" ("last_job_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_sync_events_last_job_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_sync_events_calendar"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_sync_events_owner_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concert_sync_events" DROP CONSTRAINT IF EXISTS "FK_concert_sync_events_last_job_id_jobs_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concert_sync_events" DROP CONSTRAINT IF EXISTS "FK_concert_sync_events_concert_id_concerts_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concert_sync_events" DROP CONSTRAINT IF EXISTS "FK_concert_sync_events_owner_id_user_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "concert_sync_events"');

    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_sync_jobs_status"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_sync_jobs_owner_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concert_sync_jobs" DROP CONSTRAINT IF EXISTS "FK_concert_sync_jobs_owner_id_user_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "concert_sync_jobs"');

    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concerts_top_pick_score"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_concerts_is_top_pick"');
    await queryRunner.query(
      'ALTER TABLE "concerts" DROP COLUMN IF EXISTS "top_pick_refreshed_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "concerts" DROP COLUMN IF EXISTS "top_pick_score"',
    );
    await queryRunner.query(
      'ALTER TABLE "concerts" DROP COLUMN IF EXISTS "is_top_pick"',
    );
  }
}
