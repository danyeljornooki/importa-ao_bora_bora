import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import { getRequiredMongoEnv } from '../../src/adapters/mongo/client/mongoEnv';
import { rollbackMongoTestRun } from '../../src/adapters/mongo/update-snapshots/mongoUpdateSnapshot';

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

const parseTestRunId = (): string => {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith('--testRunId='));
  const value = inline
    ? inline.slice('--testRunId='.length)
    : args[args.indexOf('--testRunId') + 1];

  if (!value || value.trim() === '') {
    throw new Error('Informe --testRunId=<id>. Rollback global nao e permitido.');
  }

  return value.trim();
};

const main = async () => {
  loadLocalEnv();
  const testRunId = parseTestRunId();
  const { uri, dbName } = getRequiredMongoEnv();
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await client.connect();
    const report = await rollbackMongoTestRun(client.db(dbName), testRunId);
    console.log(JSON.stringify({ database: dbName, ...report }, null, 2));
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

