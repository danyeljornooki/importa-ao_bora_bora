import resolveIdentifierMode from './resolveIdentifierMode';

export const buildFindQuery = (part: any, storeId?: string | number) => {
  const base: any = {
    status: { $ne: 'deleted' },
  };
  if (storeId !== undefined && storeId !== null && storeId !== '') {
    base.store_id = storeId;
  }

  const identifier = resolveIdentifierMode(part);
  const codeOriginal = part?.code ?? null;
  const idStringOriginal = part?.id_string ?? null;
  const mlbId = Array.isArray(part?.mlb_ids) ? part.mlb_ids[0] : null;

  const or: any[] = [];

  if (identifier.mode === 'id_int' && identifier.id_int !== null && identifier.id_int !== undefined) {
    or.push({ id_int: identifier.id_int });
  }

  if (codeOriginal) {
    or.push({ code: codeOriginal });
  }

  if (identifier.mode === 'etiqueta') {
    const etiqueta = identifier.id_string;
    if (etiqueta) {
      or.push({ tag_code: etiqueta });
      if (!codeOriginal) or.push({ code: etiqueta });
    }
  } else if (identifier.mode === 'id_string') {
    const codigoOrigem = identifier.id_string;
    if (codigoOrigem) {
      or.push({ id_string: codigoOrigem });
    }
  }

  if (idStringOriginal) {
    or.push({ id_string: idStringOriginal });
  }

  if (mlbId) {
    or.push({ id_string: mlbId });
  }

  if (or.length === 0) {
    throw new Error('Nenhum identificador valido para busca');
  }

  return { ...base, $or: or };
};

export default buildFindQuery;
