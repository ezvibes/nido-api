import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConcerts1760000000000 implements MigrationInterface {
  name = 'CreateConcerts1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "concerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_id" integer,
        "title" character varying(255) NOT NULL,
        "genre" character varying(120) NOT NULL,
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE,
        "venues" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "artists" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "description" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_concerts_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concerts_owner_id_user_id'
        ) THEN
          ALTER TABLE "concerts"
          ADD CONSTRAINT "FK_concerts_owner_id_user_id"
          FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concerts_owner_id" ON "concerts" ("owner_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concerts_starts_at" ON "concerts" ("starts_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_concerts_starts_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_concerts_owner_id"');
    await queryRunner.query(
      'ALTER TABLE "concerts" DROP CONSTRAINT IF EXISTS "FK_concerts_owner_id_user_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "concerts"');
  }
}
