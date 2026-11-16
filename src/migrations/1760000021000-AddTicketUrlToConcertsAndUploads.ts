import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketUrlToConcertsAndUploads1760000021000 implements MigrationInterface {
  name = 'AddTicketUrlToConcertsAndUploads1760000021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "ticket_url" varchar(1000) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      ADD COLUMN IF NOT EXISTS "ticket_url" varchar(1000) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concert_uploads"
      DROP COLUMN IF EXISTS "ticket_url"
    `);

    await queryRunner.query(`
      ALTER TABLE "concerts"
      DROP COLUMN IF EXISTS "ticket_url"
    `);
  }
}
