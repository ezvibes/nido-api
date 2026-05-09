import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConcertUpvotes1760000001000 implements MigrationInterface {
  name = 'CreateConcertUpvotes1760000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "concert_upvotes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "concert_id" uuid,
        "user_id" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_concert_upvotes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_concert_upvotes_concert_user" UNIQUE ("concert_id", "user_id")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_upvotes_concert_id_concerts_id'
        ) THEN
          ALTER TABLE "concert_upvotes"
          ADD CONSTRAINT "FK_concert_upvotes_concert_id_concerts_id"
          FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_concert_upvotes_user_id_user_id'
        ) THEN
          ALTER TABLE "concert_upvotes"
          ADD CONSTRAINT "FK_concert_upvotes_user_id_user_id"
          FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_upvotes_concert" ON "concert_upvotes" ("concert_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_upvotes_created_at" ON "concert_upvotes" ("created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_upvotes_concert_created_at" ON "concert_upvotes" ("concert_id", "created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_upvotes_concert_created_at"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_upvotes_created_at"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_upvotes_concert"',
    );
    await queryRunner.query(
      'ALTER TABLE "concert_upvotes" DROP CONSTRAINT IF EXISTS "FK_concert_upvotes_user_id_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "concert_upvotes" DROP CONSTRAINT IF EXISTS "FK_concert_upvotes_concert_id_concerts_id"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "concert_upvotes"');
  }
}
