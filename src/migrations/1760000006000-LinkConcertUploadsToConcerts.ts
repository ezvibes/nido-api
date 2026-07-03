import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkConcertUploadsToConcerts1760000006000
  implements MigrationInterface
{
  name = 'LinkConcertUploadsToConcerts1760000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      ADD COLUMN IF NOT EXISTS "concert_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_uploads_concert_id_concerts_id'
        ) THEN
          ALTER TABLE "concert_uploads"
          ADD CONSTRAINT "FK_concert_uploads_concert_id_concerts_id"
          FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_uploads_concert_id" ON "concert_uploads" ("concert_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_uploads_concert_id"',
    );
    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      DROP CONSTRAINT IF EXISTS "FK_concert_uploads_concert_id_concerts_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      DROP COLUMN IF EXISTS "concert_id"
    `);
  }
}
