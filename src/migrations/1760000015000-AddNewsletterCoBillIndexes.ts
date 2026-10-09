import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNewsletterCoBillIndexes1760000015000 implements MigrationInterface {
  name = 'AddNewsletterCoBillIndexes1760000015000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_concert_band_lineups_band_id_concert_id"
      ON "concert_band_lineups" ("band_id", "concert_id")
    `);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_concerts_newsletter_publishable_starts_at"
      ON "concerts" ("starts_at", "id")
      WHERE "catalog_status" = 'active' AND "is_admin_approved" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX CONCURRENTLY IF EXISTS "IDX_concerts_newsletter_publishable_starts_at"',
    );
    await queryRunner.query(
      'DROP INDEX CONCURRENTLY IF EXISTS "IDX_concert_band_lineups_band_id_concert_id"',
    );
  }
}
