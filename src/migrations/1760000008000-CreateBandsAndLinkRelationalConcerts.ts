import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBandsAndLinkRelationalConcerts1760000008000 implements MigrationInterface {
  name = 'CreateBandsAndLinkRelationalConcerts1760000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create bands table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bands" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "genres" text ARRAY,
        "promo_image_url" character varying,
        "spotify_url" character varying,
        "instagram_handle" character varying,
        "website_url" character varying,
        "is_featured" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bands_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bands_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_bands_slug" ON "bands" ("slug")',
    );

    // 2. Alter concerts to add venue_id
    await queryRunner.query(`
      ALTER TABLE "concerts" ADD COLUMN IF NOT EXISTS "venue_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "concerts" 
      ADD CONSTRAINT "FK_concerts_venue_id" 
      FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL
    `);

    // 3. Create concert_bands junction table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "concert_bands" (
        "concert_id" uuid NOT NULL,
        "band_id" uuid NOT NULL,
        CONSTRAINT "PK_concert_bands" PRIMARY KEY ("concert_id", "band_id"),
        CONSTRAINT "FK_concert_bands_concert_id" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_concert_bands_band_id" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_bands_concert_id" ON "concert_bands" ("concert_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_bands_band_id" ON "concert_bands" ("band_id")',
    );

    // 4. Data Migration: Extract existing JSONB venues to "venues"
    await queryRunner.query(`
      INSERT INTO "venues" ("name", "city", "city_slug", "region", "region_slug")
      SELECT DISTINCT ON (LOWER(TRIM(venue_raw.name)), LOWER(REGEXP_REPLACE(TRIM(COALESCE(venue_raw.city, 'Unknown City')), '\\s+', '-', 'g')))
        venue_raw.name,
        COALESCE(venue_raw.city, 'Unknown City'),
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(venue_raw.city, 'Unknown City')), '\\s+', '-', 'g')),
        COALESCE(venue_raw.state, 'Unknown State'),
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(venue_raw.state, 'Unknown State')), '\\s+', '-', 'g'))
      FROM "concerts",
      LATERAL jsonb_to_recordset("concerts"."venues") AS venue_raw(name text, city text, state text)
      WHERE venue_raw.name IS NOT NULL
    `);

    // 5. Data Migration: Link concerts to migrated venues
    await queryRunner.query(`
      UPDATE "concerts"
      SET "venue_id" = v.id
      FROM "venues" v
      WHERE "concerts"."venues" IS NOT NULL
        AND jsonb_array_length("concerts"."venues") > 0
        AND v.name = ("concerts"."venues"->0->>'name')
        AND v.city_slug = LOWER(REGEXP_REPLACE(TRIM(COALESCE("concerts"."venues"->0->>'city', 'Unknown City')), '\\s+', '-', 'g'))
    `);

    // 6. Data Migration: Extract existing JSONB artists to "bands"
    await queryRunner.query(`
      INSERT INTO "bands" ("name", "slug", "genres")
      SELECT DISTINCT ON (LOWER(TRIM(artist_raw.name)))
        artist_raw.name,
        LOWER(REGEXP_REPLACE(TRIM(artist_raw.name), '[^a-zA-Z0-9]+', '-', 'g')),
        ARRAY[LOWER(COALESCE(artist_raw.genre, 'Live Music'))]
      FROM "concerts",
      LATERAL jsonb_to_recordset("concerts"."artists") AS artist_raw(name text, role text, genre text)
      WHERE artist_raw.name IS NOT NULL
      ON CONFLICT ("slug") DO NOTHING
    `);

    // 7. Data Migration: Link concerts to bands in junction table
    await queryRunner.query(`
      INSERT INTO "concert_bands" ("concert_id", "band_id")
      SELECT DISTINCT c.id, b.id
      FROM "concerts" c,
      LATERAL jsonb_to_recordset(c."artists") AS artist_raw(name text, role text, genre text)
      JOIN "bands" b ON LOWER(TRIM(b.name)) = LOWER(TRIM(artist_raw.name))
      WHERE artist_raw.name IS NOT NULL
    `);

    // 8. Drop legacy JSONB columns
    await queryRunner.query('ALTER TABLE "concerts" DROP COLUMN IF EXISTS "venues"');
    await queryRunner.query('ALTER TABLE "concerts" DROP COLUMN IF EXISTS "artists"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-add legacy columns
    await queryRunner.query('ALTER TABLE "concerts" ADD COLUMN "venues" jsonb DEFAULT \'[]\'::jsonb');
    await queryRunner.query('ALTER TABLE "concerts" ADD COLUMN "artists" jsonb DEFAULT \'[]\'::jsonb');

    // 2. Re-populate venues JSONB
    await queryRunner.query(`
      UPDATE "concerts" c
      SET "venues" = json_build_array(
        json_build_object(
          'name', v.name,
          'city', v.city,
          'state', v.region,
          'country', 'US'
        )
      )::jsonb
      FROM "venues" v
      WHERE c.venue_id = v.id
    `);

    // 3. Re-populate artists JSONB
    await queryRunner.query(`
      UPDATE "concerts" c
      SET "artists" = COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'name', b.name,
              'role', 'headliner',
              'genre', COALESCE(b.genres[1], 'Live Music')
            )
          )
          FROM "concert_bands" cb
          JOIN "bands" b ON cb.band_id = b.id
          WHERE cb.concert_id = c.id
        ),
        '[]'::json
      )::jsonb
    `);

    // 4. Drop relational columns, constraints and tables
    await queryRunner.query('DROP TABLE IF EXISTS "concert_bands"');
    await queryRunner.query('ALTER TABLE "concerts" DROP CONSTRAINT IF EXISTS "FK_concerts_venue_id"');
    await queryRunner.query('ALTER TABLE "concerts" DROP COLUMN IF EXISTS "venue_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_bands_slug"');
    await queryRunner.query('DROP TABLE IF EXISTS "bands"');
  }
}
