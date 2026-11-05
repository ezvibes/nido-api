import { QueryRunner } from 'typeorm';
import { ModernizeVenuesAndDeduplicateCatalog1760000019000 } from '../../src/migrations/1760000019000-ModernizeVenuesAndDeduplicateCatalog';

describe('ModernizeVenuesAndDeduplicateCatalog1760000019000 Migration', () => {
  let migration: ModernizeVenuesAndDeduplicateCatalog1760000019000;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    migration = new ModernizeVenuesAndDeduplicateCatalog1760000019000();
    queryRunner = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT "id" FROM "venues" WHERE "name" = \'Cat\'\'s Cradle\'')) {
          return Promise.resolve([{ id: 'straight-cats-cradle-id' }]);
        }
        if (sql.includes('SELECT "id" FROM "venues" WHERE "id" = \'e6efac75-ab36-46fb-a79d-4c3807a083f0\'')) {
          return Promise.resolve([{ id: 'e6efac75-ab36-46fb-a79d-4c3807a083f0' }]);
        }
        if (sql.includes('SELECT "id" FROM "venues" WHERE "id" = \'19e888c5-a777-4174-a506-94c34f38480b\'')) {
          return Promise.resolve([{ id: '19e888c5-a777-4174-a506-94c34f38480b' }]);
        }
        if (sql.includes('SELECT "id" FROM "venues" WHERE "id" = \'ad85e015-a8dd-49ff-8d2a-8cf8b6601f9e\'')) {
          return Promise.resolve([{ id: 'ad85e015-a8dd-49ff-8d2a-8cf8b6601f9e' }]);
        }
        if (sql.includes('SELECT "id" FROM "venues" WHERE "name" ILIKE \'%pinhook%\'')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  it('has the correct migration name matching timestamp', () => {
    expect(migration.name).toBe(
      'ModernizeVenuesAndDeduplicateCatalog1760000019000',
    );
  });

  it('executes up migration without errors', async () => {
    await expect(migration.up(queryRunner)).resolves.not.toThrow();
    expect(queryRunner.query).toHaveBeenCalled();
  });

  it('executes down migration without errors', async () => {
    await expect(migration.down(queryRunner)).resolves.not.toThrow();
  });
});
