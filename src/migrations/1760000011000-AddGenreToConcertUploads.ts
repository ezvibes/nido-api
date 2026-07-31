import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGenreToConcertUploads1760000011000 implements MigrationInterface {
  name = 'AddGenreToConcertUploads1760000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      ADD COLUMN IF NOT EXISTS "genre" varchar(120)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      DROP COLUMN IF EXISTS "genre"
    `);
  }
}
