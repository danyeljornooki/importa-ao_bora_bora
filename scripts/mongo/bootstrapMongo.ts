import { MongoClient, type IndexSpecification } from 'mongodb';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRequiredMongoEnv } from '../../src/adapters/mongo/client/mongoEnv';
import { schemaContracts } from '../../src/schema-contracts';

interface CollectionReport {
  collection: string;
  status: 'created' | 'existing';
  indexes: Array<{
    name: string;
    status: 'created' | 'existing';
  }>;
}

const sameIndexKey = (
  current: Record<string, unknown>,
  expected: IndexSpecification
): boolean => JSON.stringify(current) === JSON.stringify(expected);

const loadLocalEnv = (): void => {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

const bootstrapMongo = async (): Promise<void> => {
  loadLocalEnv();
  const { uri, dbName } = getRequiredMongoEnv();
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });
  const report: CollectionReport[] = [];

  try {
    await client.connect();
    const db = client.db(dbName);
    const existingCollections = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map((collection) => collection.name)
    );

    for (const contract of schemaContracts) {
      const collectionName = contract.mongoCollection;
      const wasExisting = existingCollections.has(collectionName);

      if (!wasExisting) {
        await db.createCollection(collectionName);
      }

      const collection = db.collection(collectionName);
      const existingIndexes = await collection.indexes();
      const indexReport: CollectionReport['indexes'] = [];

      for (const index of contract.indexes) {
        const current = existingIndexes.find((candidate) => candidate.name === index.name);
        if (current && sameIndexKey(current.key, index.key)) {
          indexReport.push({ name: index.name, status: 'existing' });
          continue;
        }

        await collection.createIndex(index.key, { name: index.name });
        indexReport.push({ name: index.name, status: 'created' });
      }

      report.push({
        collection: collectionName,
        status: wasExisting ? 'existing' : 'created',
        indexes: indexReport,
      });
    }

    console.log(`Mongo bootstrap concluido. Database: ${dbName}`);
    for (const item of report) {
      console.log(`- ${item.collection}: ${item.status}`);
      for (const index of item.indexes) {
        console.log(`  - ${index.name}: ${index.status}`);
      }
    }
  } finally {
    await client.close();
  }
};

bootstrapMongo().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
