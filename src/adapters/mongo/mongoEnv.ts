export interface MongoEnv {
  uri: string;
  dbName: string;
}

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

export const getRequiredMongoEnv = (): MongoEnv => {
  const rawUri = process.env.MONGODB_URI;
  const rawDbName = process.env.MONGODB_DB;

  if (!rawUri || !unquote(rawUri)) {
    throw new Error('MONGODB_URI ausente. Configure MONGODB_URI antes de usar o Mongo.');
  }

  if (!rawDbName || !unquote(rawDbName)) {
    throw new Error('MONGODB_DB ausente. Configure MONGODB_DB antes de usar o Mongo.');
  }

  return {
    uri: unquote(rawUri),
    dbName: unquote(rawDbName),
  };
};
