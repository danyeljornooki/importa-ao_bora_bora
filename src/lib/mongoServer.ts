import 'server-only';
import { MongoClient, type Db } from 'mongodb';

/**
 * Conexao com o MongoDB do Drive Parts. SERVER-ONLY — o driver mongodb nao roda
 * no navegador. Importar este modulo no client quebra o build (proposital).
 *
 * Variaveis de ambiente (em .env, nunca commitar). Aceita o nome convencional
 * OU o alternativo entre parenteses:
 *   MONGO_URI  (ou MONGODB_URL)  connection string do Drive Parts (producao!)
 *   MONGO_DB   (ou MONGODB_DB)   nome do banco (default: driveparts)
 *   MONGO_WRITE_ENABLED          'true' libera escrita real; qualquer outro = bloqueado
 */

let client: MongoClient | null = null;
let db: Db | null = null;

const mongoUri = (): string | undefined => process.env.MONGO_URI ?? process.env.MONGODB_URL;
const mongoDbName = (): string => process.env.MONGO_DB ?? process.env.MONGODB_DB ?? 'driveparts';

export const isMongoConfigured = (): boolean => Boolean(mongoUri());

/** Kill-switch: escrita real só acontece com MONGO_WRITE_ENABLED=true. */
export const isMongoWriteEnabled = (): boolean =>
  process.env.MONGO_WRITE_ENABLED === 'true';

export const getMongoDb = async (): Promise<Db> => {
  if (db) return db;
  const uri = mongoUri();
  if (!uri) throw new Error('MONGO_URI (ou MONGODB_URL) não configurada no servidor');
  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  db = client.db(mongoDbName());
  return db;
};

export const pingMongo = async (): Promise<boolean> => {
  const d = await getMongoDb();
  await d.command({ ping: 1 });
  return true;
};

export const closeMongo = async (): Promise<void> => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
};
