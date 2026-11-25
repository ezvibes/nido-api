import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInstagramConnections1760000023000 implements MigrationInterface {
  name = 'CreateInstagramConnections1760000023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "instagram_connections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "instagram_user_id" varchar(128) NOT NULL,
        "username" varchar(128) NULL,
        "account_type" varchar(64) NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "access_token_encrypted" text NULL,
        "token_expires_at" timestamptz NULL,
        "last_refreshed_at" timestamptz NULL,
        "status" varchar(32) NOT NULL DEFAULT 'connected',
        "connected_by_email" varchar(255) NULL,
        "connected_at" timestamptz NULL,
        "revoked_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_instagram_connections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_instagram_connections_instagram_user_id" UNIQUE ("instagram_user_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_instagram_connections_status"
      ON "instagram_connections" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_instagram_connections_status"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "instagram_connections"
    `);
  }
}
