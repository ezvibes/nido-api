import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIngestionInfrastructure1760000005000 implements MigrationInterface {
  name = 'CreateIngestionInfrastructure1760000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "concert_uploads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storage_uri" character varying NOT NULL,
        "object_name" character varying NOT NULL,
        "bucket" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "original_filename" character varying NOT NULL,
        "city" character varying,
        "state" character varying,
        "source" character varying NOT NULL DEFAULT 'flyer_upload',
        "uploaded_by_uid" character varying NOT NULL,
        "uploaded_by_user_id" integer,
        "size" bigint NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "review_status" character varying NOT NULL DEFAULT 'submitted',
        "review_notes" text,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_by_user_id" integer,
        CONSTRAINT "PK_concert_uploads_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_uploads_uploaded_by_user_id_user_id'
        ) THEN
          ALTER TABLE "concert_uploads"
          ADD CONSTRAINT "FK_concert_uploads_uploaded_by_user_id_user_id"
          FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_uploads_reviewed_by_user_id_user_id'
        ) THEN
          ALTER TABLE "concert_uploads"
          ADD CONSTRAINT "FK_concert_uploads_reviewed_by_user_id_user_id"
          FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ingestion_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "concert_upload_id" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'queued',
        "stage" character varying,
        "ocr_provider" character varying,
        "ocr_confidence" real,
        "parser_version" character varying,
        "parse_confidence" real,
        "error_message" text,
        "ocr_text" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ingestion_jobs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_ingestion_jobs_concert_upload_id_uploads_id'
        ) THEN
          ALTER TABLE "ingestion_jobs"
          ADD CONSTRAINT "FK_ingestion_jobs_concert_upload_id_uploads_id"
          FOREIGN KEY ("concert_upload_id") REFERENCES "concert_uploads"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_uploads_uploaded_by_user_id" ON "concert_uploads" ("uploaded_by_user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_uploads_uploaded_by_uid" ON "concert_uploads" ("uploaded_by_uid")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_uploads_review_status" ON "concert_uploads" ("review_status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_uploads_created_at" ON "concert_uploads" ("created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_uploads_reviewed_by_user_id" ON "concert_uploads" ("reviewed_by_user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_ingestion_jobs_concert_upload_id" ON "ingestion_jobs" ("concert_upload_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_ingestion_jobs_status" ON "ingestion_jobs" ("status")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_ingestion_jobs_status"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_ingestion_jobs_concert_upload_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "ingestion_jobs" DROP CONSTRAINT IF EXISTS "FK_ingestion_jobs_concert_upload_id_uploads_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "ingestion_jobs"');

    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_uploads_reviewed_by_user_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_uploads_created_at"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_uploads_review_status"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_uploads_uploaded_by_uid"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_uploads_uploaded_by_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concert_uploads" DROP CONSTRAINT IF EXISTS "FK_concert_uploads_reviewed_by_user_id_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concert_uploads" DROP CONSTRAINT IF EXISTS "FK_concert_uploads_uploaded_by_user_id_user_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "concert_uploads"');
  }
}
