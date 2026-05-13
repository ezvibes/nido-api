import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConcertAdminApproval1760000004000 implements MigrationInterface {
  name = 'AddConcertAdminApproval1760000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "is_admin_approved" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "admin_approved_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "concerts"
      ADD COLUMN IF NOT EXISTS "admin_approved_by_user_id" integer
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concerts_admin_approved_by_user_id_user_id'
        ) THEN
          ALTER TABLE "concerts"
          ADD CONSTRAINT "FK_concerts_admin_approved_by_user_id_user_id"
          FOREIGN KEY ("admin_approved_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concerts_is_admin_approved" ON "concerts" ("is_admin_approved")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concerts_admin_approved_by_user_id" ON "concerts" ("admin_approved_by_user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concerts_admin_approved_by_user_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concerts_is_admin_approved"',
    );
    await queryRunner.query(
      'ALTER TABLE "concerts" DROP CONSTRAINT IF EXISTS "FK_concerts_admin_approved_by_user_id_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concerts" DROP COLUMN IF EXISTS "admin_approved_by_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concerts" DROP COLUMN IF EXISTS "admin_approved_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "concerts" DROP COLUMN IF EXISTS "is_admin_approved"',
    );
  }
}
