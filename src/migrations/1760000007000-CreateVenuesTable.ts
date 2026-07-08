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
        "citySlug" character varying NOT NULL,
        "region" character varying NOT NULL,
        "regionSlug" character varying NOT NULL,
        "lat" numeric(10,7),
        "lng" numeric(10,7),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_venues_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_venues_city_slug" ON "venues" ("citySlug")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_venues_city_slug"');
    await queryRunner.query('DROP TABLE IF EXISTS "venues"');
  }
}
