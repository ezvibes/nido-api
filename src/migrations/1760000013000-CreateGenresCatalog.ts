import { MigrationInterface, QueryRunner } from 'typeorm';

const GENRES = [
  { slug: 'jazz', name: 'Jazz', sortOrder: 10 },
  { slug: 'bluegrass', name: 'Bluegrass', sortOrder: 20 },
  { slug: 'funk', name: 'Funk', sortOrder: 30 },
  { slug: 'jam', name: 'Jam', sortOrder: 40 },
  { slug: 'reggae', name: 'Reggae', sortOrder: 50 },
  { slug: 'hip-hop', name: 'Hip-Hop', sortOrder: 60 },
  { slug: 'rock', name: 'Rock', sortOrder: 70 },
  { slug: 'folk', name: 'Folk', sortOrder: 80 },
  { slug: 'salsa', name: 'Salsa', sortOrder: 90 },
  { slug: 'electronic', name: 'Electronic', sortOrder: 100 },
] as const;

export class CreateGenresCatalog1760000013000 implements MigrationInterface {
  name = 'CreateGenresCatalog1760000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "genres" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(80) NOT NULL,
        "name" character varying(120) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "parent_genre_slug" character varying(80),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_genres_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_genres_slug" UNIQUE ("slug"),
        CONSTRAINT "CHK_genres_slug_lowercase" CHECK ("slug" = lower("slug"))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_genres_active_sort"
      ON "genres" ("is_active", "sort_order", "name")
    `);

    for (const genre of GENRES) {
      await queryRunner.query(
        `
          INSERT INTO "genres" ("slug", "name", "sort_order")
          VALUES ($1, $2, $3)
          ON CONFLICT ("slug") DO UPDATE
          SET
            "name" = EXCLUDED."name",
            "sort_order" = EXCLUDED."sort_order",
            "is_active" = true,
            "updated_at" = now()
        `,
        [genre.slug, genre.name, genre.sortOrder],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_genres_active_sort"');
    await queryRunner.query('DROP TABLE IF EXISTS "genres"');
  }
}
