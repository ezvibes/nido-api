import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVenuePartnerInvites1760000022000
  implements MigrationInterface
{
  name = 'CreateVenuePartnerInvites1760000022000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "venue_partner_invites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(64) NOT NULL,
        "venue_id" uuid NOT NULL,
        "invited_email" varchar(255) NULL,
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "redeemed_by_user_id" integer NULL,
        "redeemed_at" timestamptz NULL,
        "expires_at" timestamptz NULL,
        "created_by_user_id" integer NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_venue_partner_invites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_venue_partner_invites_code" UNIQUE ("code"),
        CONSTRAINT "FK_venue_partner_invites_venue" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_venue_partner_invites_redeemed_by" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_venue_partner_invites_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "venue_partner_invites"
    `);
  }
}
