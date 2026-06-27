import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { MongoClient } from 'mongodb';
import { MONGO_COLLECTIONS } from '../../src/adapters/mongo/client/collectionNames';
import { getRequiredMongoEnv } from '../../src/adapters/mongo/client/mongoEnv';
import {
  parseParteJson,
  seedParteDocuments,
} from '../../src/adapters/mongo/parte/parteReferenceSeed';

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

const valueOf = (name: string): string | null => {
  const args = process.argv.slice(2);
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim().replace(/^['"]|['"]$/g, '');
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1]?.trim().replace(/^['"]|['"]$/g, '') ?? null : null;
};

const main = async () => {
  loadLocalEnv();
  const file = valueOf('file');
  if (!file) throw new Error('Informe --file=<caminho/parte.json>.');

  const docs = parseParteJson(readFileSync(file, 'utf8'));
  const { uri, dbName } = getRequiredMongoEnv();
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(MONGO_COLLECTIONS.parte);
    const report = await seedParteDocuments(collection, docs, { file: basename(file) });
    const total = await collection.countDocuments();
    const examples = await collection
      .find(
        {},
        {
          projection: {
            _id: 0,
            MLB_categoria_id: 1,
            nome: 1,
            shopee_category_id: 1,
            vehicle_type: 1,
          },
        }
      )
      .limit(5)
      .toArray();

    console.log(JSON.stringify({
      database: dbName,
      collection: MONGO_COLLECTIONS.parte,
      report,
      countDocuments: total,
      examples,
    }, null, 2));
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
