import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import { MONGO_COLLECTIONS } from '../../src/adapters/mongo/client/collectionNames';
import { getRequiredMongoEnv } from '../../src/adapters/mongo/client/mongoEnv';
import { countPendingMongoUpdateSnapshots } from '../../src/adapters/mongo/update-snapshots/mongoUpdateSnapshot';

const ALLOWED_SOURCES = [
  'real_20_parts_mongo_test',
  'mongo_import_adapter_v1',
  'official_import_target_mongo',
];

const loadLocalEnv = (): void => {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
};

const testRunId = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--testRunId='))
  ?.slice('--testRunId='.length)
  .trim();

if (!testRunId) {
  throw new Error('Informe --testRunId=<id>.');
}

loadLocalEnv();

const main = async () => {
  const { uri, dbName } = getRequiredMongoEnv();
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  const filter = {
    'metadata.source': { $in: ALLOWED_SOURCES },
    'metadata.testRunId': testRunId,
    'metadata.testCreated': true,
  };

  try {
    await client.connect();
    const db = client.db(dbName);
    const pendingSnapshots = await countPendingMongoUpdateSnapshots(db, testRunId);
    if (pendingSnapshots > 0) {
      console.warn(
        'Existem updates com snapshot ainda nao revertidos. Execute mongo:rollback-test antes do cleanup se quiser desfazer updates.'
      );
    }
    const collections = [
      MONGO_COLLECTIONS.storageLocations,
      MONGO_COLLECTIONS.inventoryItems,
      MONGO_COLLECTIONS.mercadoLivreBrasilAnuncio,
      MONGO_COLLECTIONS.importRuns,
      MONGO_COLLECTIONS.importRunItems,
    ];

    const report: Record<string, number> = {};
    for (const collectionName of collections) {
      const result = await db.collection(collectionName).deleteMany(filter);
      report[collectionName] = result.deletedCount;
    }

    console.log(JSON.stringify({ database: dbName, testRunId, deleted: report }, null, 2));
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
