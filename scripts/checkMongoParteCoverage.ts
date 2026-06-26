import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { MongoClient } from 'mongodb';
import { MONGO_COLLECTIONS } from '../src/adapters/mongo/collectionNames';
import { getRequiredMongoEnv } from '../src/adapters/mongo/mongoEnv';
import { loadParteCoverageFromFile } from '../src/adapters/mongo/parteCoverage';

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
  if (!file) throw new Error('Informe --file=<caminho/planilha.csv>.');

  const { uri, dbName } = getRequiredMongoEnv();
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    const report = await loadParteCoverageFromFile(
      readFileSync(file),
      basename(file),
      db.collection(MONGO_COLLECTIONS.parte)
    );

    console.log(JSON.stringify({
      database: dbName,
      collection: MONGO_COLLECTIONS.parte,
      file: basename(file),
      note: report.required.length === 0
        ? 'Nenhuma categoria MLB explicita foi encontrada no arquivo. Se a planilha so possui MLB de anuncio, use o dry run com integrationId para resolver category_id via Mercado Livre.'
        : undefined,
      coverage: report,
    }, null, 2));
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
