import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostalCodeCapacityAndVerificationToVenues1760000018000
  implements MigrationInterface
{
  name = 'AddPostalCodeCapacityAndVerificationToVenues1760000018000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venues_verification_state_enum') THEN
          CREATE TYPE "venues_verification_state_enum" AS ENUM ('unverified', 'verified', 'flagged', 'canonical');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "venues"
      ADD COLUMN IF NOT EXISTS "postal_code" character varying,
      ADD COLUMN IF NOT EXISTS "capacity" integer,
      ADD COLUMN IF NOT EXISTS "verification_state" "venues_verification_state_enum" NOT NULL DEFAULT 'unverified'
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_venues_verification_state" ON "venues" ("verification_state")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_venues_verification_state"',
    );
    await queryRunner.query(`
      ALTER TABLE "venues"
      DROP COLUMN IF EXISTS "verification_state",
      DROP COLUMN IF EXISTS "capacity",
      DROP COLUMN IF EXISTS "postal_code"
    `);
    await queryRunner.query(
      'DROP TYPE IF EXISTS "venues_verification_state_enum"',
    );
  }
}
