import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVenuesTable1760000007000 implements MigrationInterface {
  name = 'CreateVenuesTable1760000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "venues" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "address" character varying,
        "city" character varying NOT NULL,
        "city_slug" character varying NOT NULL,
        "region" character varying NOT NULL,
        "region_slug" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_venues_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_venues_city_slug" ON "venues" ("city_slug")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_venues_city_slug"');
    await queryRunner.query('DROP TABLE IF EXISTS "venues"');
  }
}
