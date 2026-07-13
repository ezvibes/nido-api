import dataSource from '../data-source';

const TRANSACTION_MODES = ['all', 'each', 'none'] as const;
type TransactionMode = (typeof TRANSACTION_MODES)[number];

function getTransactionMode(): TransactionMode {
  const mode = process.env.DB_MIGRATION_TRANSACTION_MODE ?? 'all';
  if (!TRANSACTION_MODES.includes(mode as TransactionMode)) {
    throw new Error(
      `Invalid DB_MIGRATION_TRANSACTION_MODE "${mode}". Use all, each, or none.`,
    );
  }
  return mode as TransactionMode;
}

async function runMigrations() {
  const transactionMode = getTransactionMode();
  await dataSource.initialize();

  try {
    const hasPendingMigrations = await dataSource.showMigrations();
    console.log(`Pending migrations: ${hasPendingMigrations ? 'yes' : 'no'}`);

    const migrations = await dataSource.runMigrations({
      transaction: transactionMode,
    });

    if (migrations.length === 0) {
      console.log('No migrations were applied.');
      return;
    }

    console.log(`Applied ${migrations.length} migration(s):`);
    for (const migration of migrations) {
      console.log(`- ${migration.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

runMigrations().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
