import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLineupOrderingRolesAndSets1760000009000 implements MigrationInterface {
  name = 'AddLineupOrderingRolesAndSets1760000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create concert_band_lineups table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "concert_band_lineups" (
        "concert_id" uuid NOT NULL,
        "band_id" uuid NOT NULL,
        "performance_order" integer NOT NULL DEFAULT 0,
        "performance_role" character varying(50) NOT NULL DEFAULT 'support',
        CONSTRAINT "PK_concert_band_lineups" PRIMARY KEY ("concert_id", "band_id"),
        CONSTRAINT "FK_concert_band_lineups_concert_id" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_concert_band_lineups_band_id" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE
      )
    `);

    // 2. Create concert_sets table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "concert_sets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "concert_id" uuid NOT NULL,
        "band_id" uuid NOT NULL,
        "stage_name" character varying(255) NOT NULL,
        "starts_at" timestamp with time zone NOT NULL,
        "ends_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_concert_sets_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_concert_sets_concert_id" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_concert_sets_band_id" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE
      )
    `);

    // 3. Add socials JSONB column to bands
    await queryRunner.query(`
      ALTER TABLE "bands" ADD COLUMN IF NOT EXISTS "socials" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);

    // 4. Data Migration: copy from simple join table to new rich junction table
    await queryRunner.query(`
      INSERT INTO "concert_band_lineups" ("concert_id", "band_id", "performance_order", "performance_role")
      SELECT "concert_id", "band_id", 0, 'headliner'
      FROM "concert_bands"
      ON CONFLICT DO NOTHING
    `);

    // 5. Drop legacy simple join table
    await queryRunner.query('DROP TABLE IF EXISTS "concert_bands"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-create simple join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "concert_bands" (
        "concert_id" uuid NOT NULL,
        "band_id" uuid NOT NULL,
        CONSTRAINT "PK_concert_bands_legacy" PRIMARY KEY ("concert_id", "band_id"),
        CONSTRAINT "FK_concert_bands_concert_id_legacy" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_concert_bands_band_id_legacy" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE
      )
    `);

    // 2. Re-populate simple join table
    await queryRunner.query(`
      INSERT INTO "concert_bands" ("concert_id", "band_id")
      SELECT "concert_id", "band_id"
      FROM "concert_band_lineups"
      ON CONFLICT DO NOTHING
    `);

    // 3. Drop rich tables and columns
    await queryRunner.query('DROP TABLE IF EXISTS "concert_sets"');
    await queryRunner.query('DROP TABLE IF EXISTS "concert_band_lineups"');
    await queryRunner.query('ALTER TABLE "bands" DROP COLUMN IF EXISTS "socials"');
  }
}
