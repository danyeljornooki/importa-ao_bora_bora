import { MongoClient } from 'mongodb';
import { AppNavigation } from '../../components/AppNavigation';
import { getRequiredMongoEnv } from '../../adapters/mongo/mongoEnv';
import { schemaContracts } from '../../schema-contracts';

export const dynamic = 'force-dynamic';

interface MongoCollectionStatus {
  collection: string;
  exists: boolean;
  estimatedDocuments: number | null;
  indexes: string[];
  error?: string;
}

const loadMongoStatus = async (): Promise<{
  connected: boolean;
  database: string | null;
  collections: MongoCollectionStatus[];
  error?: string;
}> => {
  let env;
  try {
    env = getRequiredMongoEnv();
  } catch (error) {
    return {
      connected: false,
      database: null,
      collections: schemaContracts.map((contract) => ({
        collection: contract.mongoCollection,
        exists: false,
        estimatedDocuments: null,
        indexes: [],
      })),
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const client = new MongoClient(env.uri, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await client.connect();
    const db = client.db(env.dbName);
    const existingCollections = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map((collection) => collection.name)
    );

    const collections: MongoCollectionStatus[] = [];
    for (const contract of schemaContracts) {
      const exists = existingCollections.has(contract.mongoCollection);
      if (!exists) {
        collections.push({
          collection: contract.mongoCollection,
          exists: false,
          estimatedDocuments: null,
          indexes: [],
        });
        continue;
      }

      try {
        const collection = db.collection(contract.mongoCollection);
        const [estimatedDocuments, indexes] = await Promise.all([
          collection.estimatedDocumentCount(),
          collection.indexes(),
        ]);
        collections.push({
          collection: contract.mongoCollection,
          exists: true,
          estimatedDocuments,
          indexes: indexes.map((index) => index.name ?? JSON.stringify(index.key)),
        });
      } catch (error) {
        collections.push({
          collection: contract.mongoCollection,
          exists: true,
          estimatedDocuments: null,
          indexes: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      connected: true,
      database: env.dbName,
      collections,
    };
  } catch (error) {
    return {
      connected: false,
      database: env.dbName,
      collections: schemaContracts.map((contract) => ({
        collection: contract.mongoCollection,
        exists: false,
        estimatedDocuments: null,
        indexes: [],
      })),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await client.close();
  }
};

export default async function MongoTestPage() {
  const status = await loadMongoStatus();

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 56px', backgroundColor: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 1120, margin: '0 auto' }}>
        <AppNavigation />
        <header style={{ marginBottom: 24 }}>
          <div style={{ color: '#2563eb', fontSize: 13, fontWeight: 700 }}>Mongo laboratorio</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 32 }}>Mongo Test</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Tela read-only para conferir conexao, database, collections esperadas e indices.
          </p>
        </header>

        <section style={{ padding: 16, border: '1px solid #dbe2ea', borderRadius: 8, backgroundColor: '#fff', marginBottom: 18 }}>
          <div><strong>Conectado:</strong> {status.connected ? 'sim' : 'nao'}</div>
          <div><strong>Database:</strong> {status.database ?? '-'}</div>
          {status.error && <div style={{ marginTop: 8, color: '#b91c1c' }}>{status.error}</div>}
        </section>

        <div style={{ display: 'grid', gap: 12 }}>
          {status.collections.map((collection) => (
            <section key={collection.collection} style={{ padding: 16, border: '1px solid #dbe2ea', borderRadius: 8, backgroundColor: '#fff' }}>
              <h2 style={{ margin: '0 0 10px', fontSize: 20 }}>{collection.collection}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <div><strong>Existe:</strong> {collection.exists ? 'sim' : 'nao'}</div>
                <div><strong>Docs aprox.:</strong> {collection.estimatedDocuments ?? '-'}</div>
              </div>
              {collection.error && <div style={{ marginTop: 8, color: '#b91c1c' }}>{collection.error}</div>}
              <div style={{ marginTop: 12 }}>
                <strong>Indices</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  {collection.indexes.length > 0 ? (
                    collection.indexes.map((index) => <li key={index}>{index}</li>)
                  ) : (
                    <li>Nenhum indice encontrado pela tela</li>
                  )}
                </ul>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
