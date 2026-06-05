export type IdentifierMode = 'etiqueta' | 'id_int' | 'id_string';

export interface IdentifierResult {
  mode: IdentifierMode;
  id_int: number | null;
  id_string: string | null;
}

const isNumericString = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (s === '') return false;
  return /^-?\d+$/.test(s);
};

export const resolveIdentifierMode = (part: any): IdentifierResult => {
  // defensive copies
  const tag = part?.tag_code ?? '';
  const codigoOrigem = part?.idString ?? part?.codigo_origem ?? part?.id_int ?? '';
  const modoInformado = part?.modo_identificador ?? '';

  let mode: IdentifierMode = 'id_string';
  let id_int: number | null = null;
  let id_string: string | null = null;

  const tagExists = typeof tag === 'string' && tag.trim() !== '';
  const codigoExists = codigoOrigem !== undefined && codigoOrigem !== null && String(codigoOrigem).trim() !== '';

  const normalizedCodigo = codigoExists ? String(codigoOrigem).trim() : '';

  const effectiveModo = typeof modoInformado === 'string' ? modoInformado : '';

  const validModes = ['etiqueta', 'id_int', 'id_string', 'idpeca'];

  let selected = effectiveModo && validModes.includes(effectiveModo) ? effectiveModo : null;

  if (!selected) {
    if (tagExists) selected = 'etiqueta';
    else if (codigoExists && isNumericString(normalizedCodigo)) selected = 'id_int';
    else selected = 'id_string';
  }

  // special idpeca handling
  if (selected === 'idpeca') {
    if (isNumericString(normalizedCodigo)) selected = 'id_int';
    else selected = 'id_string';
  }

  if (selected === 'etiqueta') {
    mode = 'etiqueta';
    id_int = null;
    id_string = tagExists ? String(tag) : null;
  } else if (selected === 'id_int') {
    mode = 'id_int';
    const asNum = Number(String(normalizedCodigo));
    id_int = Number.isFinite(asNum) ? asNum : null;
    id_string = null;
  } else {
    mode = 'id_string';
    id_int = null;
    id_string = codigoExists ? String(normalizedCodigo) : null;
  }

  return {
    mode,
    id_int,
    id_string,
  };
};

export default resolveIdentifierMode;
