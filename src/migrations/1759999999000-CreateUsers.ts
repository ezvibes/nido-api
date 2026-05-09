import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1759999999000 implements MigrationInterface {
  name = 'CreateUsers1759999999000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" SERIAL NOT NULL,
        "email" character varying NOT NULL,
        "uid" character varying NOT NULL,
        "picture" character varying,
        "name" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_email_unique" ON "user" ("email")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_uid_unique" ON "user" ("uid")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_uid_unique"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_email_unique"');
    await queryRunner.query('DROP TABLE IF EXISTS "user"');
  }
}
