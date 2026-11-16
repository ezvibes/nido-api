import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPartnerOnboardingToUser1760000020000 implements MigrationInterface {
  name = 'AddPartnerOnboardingToUser1760000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "claimed_venue_id" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "venue_claim_status" varchar(32) NOT NULL DEFAULT 'none'
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamptz NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_user_claimed_venue'
        ) THEN
          ALTER TABLE "user"
          ADD CONSTRAINT "FK_user_claimed_venue"
          FOREIGN KEY ("claimed_venue_id")
          REFERENCES "venues"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Ensure canonical Bowstring NC venues exist for partner onboarding claims.
    await queryRunner.query(`
      INSERT INTO "venues" (
        "id",
        "name",
        "address",
        "city",
        "city_slug",
        "region",
        "region_slug",
        "postal_code",
        "capacity",
        "verification_state"
      )
      SELECT
        'e6efac75-ab36-46fb-a79d-4c3807a083f0',
        'Bowstring Brewyard',
        '1930 Wake Forest Rd',
        'Raleigh',
        'raleigh',
        'North Carolina',
        'nc',
        '27608',
        500,
        'canonical'
      WHERE NOT EXISTS (
        SELECT 1
        FROM "venues"
        WHERE LOWER("name") LIKE '%bowstring%'
          AND "city_slug" = 'raleigh'
      )
    `);

    await queryRunner.query(`
      INSERT INTO "venues" (
        "id",
        "name",
        "address",
        "city",
        "city_slug",
        "region",
        "region_slug",
        "postal_code",
        "capacity",
        "verification_state"
      )
      SELECT
        'e5e9f41f-d2de-4e34-affa-971c9ac9e89a',
        'Bowstring Brewyard Wilmington',
        '1002 N 4th St',
        'Wilmington',
        'wilmington',
        'North Carolina',
        'nc',
        '28401',
        400,
        'verified'
      WHERE NOT EXISTS (
        SELECT 1
        FROM "venues"
        WHERE LOWER("name") LIKE '%bowstring%'
          AND "city_slug" = 'wilmington'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP CONSTRAINT IF EXISTS "FK_user_claimed_venue"
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "onboarding_completed_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "venue_claim_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "claimed_venue_id"
    `);
  }
}
