import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConcertCatalogManagement1760000012000 implements MigrationInterface {
  name = 'AddConcertCatalogManagement1760000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "catalog_status" varchar(20) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "editorial_locked_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD CONSTRAINT "CHK_concerts_catalog_status"
      CHECK ("catalog_status" IN ('active', 'hidden', 'archived'))
    `);

    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD CONSTRAINT "CHK_concerts_featured_active"
      CHECK ("catalog_status" = 'active' OR "is_featured" = false)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concerts_catalog_status_starts_at"
      ON "concerts" ("catalog_status", "starts_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_concerts_active_featured"
      ON "concerts" ("is_featured", "starts_at")
      WHERE "catalog_status" = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concerts_active_featured"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concerts_catalog_status_starts_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "concerts" DROP CONSTRAINT IF EXISTS "CHK_concerts_featured_active"',
    );
    await queryRunner.query(
      'ALTER TABLE "concerts" DROP CONSTRAINT IF EXISTS "CHK_concerts_catalog_status"',
    );
    await queryRunner.query(`
      ALTER TABLE "concerts"
      DROP COLUMN IF EXISTS "version",
      DROP COLUMN IF EXISTS "editorial_locked_at",
      DROP COLUMN IF EXISTS "is_featured",
      DROP COLUMN IF EXISTS "catalog_status"
    `);
  }
}
