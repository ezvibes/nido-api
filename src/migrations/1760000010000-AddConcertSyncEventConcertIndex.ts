import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConcertSyncEventConcertIndex1760000010000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_concert_sync_events_concert_id" ON "concert_sync_events" ("concert_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_concert_sync_events_concert_id"',
    );
  }
}
