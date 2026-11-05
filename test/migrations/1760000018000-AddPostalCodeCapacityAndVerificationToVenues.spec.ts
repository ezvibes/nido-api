import { QueryRunner } from 'typeorm';
import { AddPostalCodeCapacityAndVerificationToVenues1760000018000 } from '../../src/migrations/1760000018000-AddPostalCodeCapacityAndVerificationToVenues';

describe('AddPostalCodeCapacityAndVerificationToVenues1760000018000 Migration', () => {
  let migration: AddPostalCodeCapacityAndVerificationToVenues1760000018000;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new AddPostalCodeCapacityAndVerificationToVenues1760000018000();
    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it('has the correct migration name matching timestamp', () => {
    expect(migration.name).toBe(
      'AddPostalCodeCapacityAndVerificationToVenues1760000018000',
    );
  });

  describe('up', () => {
    it('creates enum type, adds columns with default, and creates index', async () => {
      await migration.up(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);

      // 1. Create enum type if not exists
      const typeSql = queryRunner.query.mock.calls[0][0];
      expect(typeSql).toContain('venues_verification_state_enum');
      expect(typeSql).toContain(
        "ENUM ('unverified', 'verified', 'flagged', 'canonical')",
      );

      // 2. Add postal_code, capacity, and verification_state columns
      const alterSql = queryRunner.query.mock.calls[1][0];
      expect(alterSql).toContain('ALTER TABLE "venues"');
      expect(alterSql).toContain('ADD COLUMN IF NOT EXISTS "postal_code"');
      expect(alterSql).toContain('ADD COLUMN IF NOT EXISTS "capacity"');
      expect(alterSql).toContain(
        'ADD COLUMN IF NOT EXISTS "verification_state" "venues_verification_state_enum" NOT NULL DEFAULT \'unverified\'',
      );

      // 3. Create index on verification_state
      const indexSql = queryRunner.query.mock.calls[2][0];
      expect(indexSql).toContain('CREATE INDEX IF NOT EXISTS "IDX_venues_verification_state"');
      expect(indexSql).toContain('ON "venues" ("verification_state")');
    });
  });

  describe('down', () => {
    it('reverts migration cleanly by dropping index, columns, and enum type', async () => {
      await migration.down(queryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);

      // 1. Drop index
      expect(queryRunner.query.mock.calls[0][0]).toContain(
        'DROP INDEX IF EXISTS "IDX_venues_verification_state"',
      );

      // 2. Drop columns
      const dropColumnsSql = queryRunner.query.mock.calls[1][0];
      expect(dropColumnsSql).toContain('DROP COLUMN IF EXISTS "verification_state"');
      expect(dropColumnsSql).toContain('DROP COLUMN IF EXISTS "capacity"');
      expect(dropColumnsSql).toContain('DROP COLUMN IF EXISTS "postal_code"');

      // 3. Drop type
      expect(queryRunner.query.mock.calls[2][0]).toContain(
        'DROP TYPE IF EXISTS "venues_verification_state_enum"',
      );
    });
  });
});
