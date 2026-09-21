import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUploadMetadataHints1760000014000
  implements MigrationInterface
{
  name = 'AddUploadMetadataHints1760000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      ADD COLUMN IF NOT EXISTS "concert_date" timestamptz,
      ADD COLUMN IF NOT EXISTS "venue_id" uuid,
      ADD COLUMN IF NOT EXISTS "band_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_uploads_venue_id_venues_id'
        ) THEN
          ALTER TABLE "concert_uploads"
          ADD CONSTRAINT "FK_concert_uploads_venue_id_venues_id"
          FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_uploads_band_id_bands_id'
        ) THEN
          ALTER TABLE "concert_uploads"
          ADD CONSTRAINT "FK_concert_uploads_band_id_bands_id"
          FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_uploads_venue_id" ON "concert_uploads" ("venue_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_uploads_band_id" ON "concert_uploads" ("band_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_uploads_concert_date" ON "concert_uploads" ("concert_date")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_concert_uploads_concert_date"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_concert_uploads_band_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_concert_uploads_venue_id"');
    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      DROP CONSTRAINT IF EXISTS "FK_concert_uploads_band_id_bands_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      DROP CONSTRAINT IF EXISTS "FK_concert_uploads_venue_id_venues_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      DROP COLUMN IF EXISTS "band_id",
      DROP COLUMN IF EXISTS "venue_id",
      DROP COLUMN IF EXISTS "concert_date"
    `);
  }
}
