import {
  aliasesByField,
  canonicalFieldKeys,
  type CanonicalField,
} from '../../modules/importer/fieldAliases';
import type { ColumnMapping } from '../../modules/importer/suggestFieldMapping';

/**
 * Sugestao de mapeamento de colunas por IA (OpenAI).
 *
 * Usado quando a similaridade (suggestFieldMapping) nao resolve — nomes de coluna
 * muito fora do padrao. Roda SO no servidor (a chave fica em OPENAI_API_KEY).
 * A validacao da resposta e PURA e testavel (sanitizeAiMapping); a chamada de
 * rede e fina.
 */

export interface AiMappingResult {
  mapping: ColumnMapping;
  reasoning?: string;
}

const FIELD_HINTS: Record<CanonicalField, string> = {
  code: 'codigo interno/SKU da peca',
  id_int: 'identificador interno numerico (id_int)',
  title: 'titulo ou nome da peca/anuncio',
  price: 'preco de venda',
  stock_quantity: 'quantidade em estoque',
  location: 'localizacao fisica no estoque',
  description: 'descricao longa',
  mlb_ids: 'codigo(s) de anuncio do Mercado Livre (MLBxxxx)',
  image_urls: 'URLs de imagens',
};

/**
 * Valida a resposta da IA contra os cabecalhos REAIS da planilha: descarta
 * campos desconhecidos e colunas que a IA inventou (alucinacao). PURO.
 */
export const sanitizeAiMapping = (
  raw: unknown,
  headers: string[]
): ColumnMapping => {
  const mapping: ColumnMapping = {};
  if (!raw || typeof raw !== 'object') return mapping;

  const source = (raw as Record<string, unknown>).mapping ?? raw;
  if (!source || typeof source !== 'object') return mapping;

  const headerSet = new Set(headers);
  const validFields = new Set<string>(canonicalFieldKeys);

  for (const [field, value] of Object.entries(source as Record<string, unknown>)) {
    if (!validFields.has(field)) continue;
    if (typeof value !== 'string') continue;
    const header = value.trim();
    if (header === '' || !headerSet.has(header)) continue;
    mapping[field as CanonicalField] = header;
  }

  return mapping;
};

const buildPrompt = (headers: string[], sample: Record<string, unknown>[]): string => {
  const fields = canonicalFieldKeys
    .map((f) => `- "${f}": ${FIELD_HINTS[f]} (aliases conhecidos: ${aliasesByField[f].slice(0, 4).join(', ')})`)
    .join('\n');

  return [
    'Voce mapeia colunas de uma planilha de pecas automotivas para campos canonicos.',
    '',
    'Campos canonicos:',
    fields,
    '',
    `Cabecalhos da planilha: ${JSON.stringify(headers)}`,
    '',
    `Amostra (ate 10 linhas): ${JSON.stringify(sample.slice(0, 10))}`,
    '',
    'Responda APENAS um JSON { "mapping": { campo_canonico: nome_exato_da_coluna } }.',
    'Use somente nomes de coluna que existam na lista de cabecalhos. Omita campos sem coluna correspondente.',
  ].join('\n');
};

export const suggestMappingWithAi = async (
  headers: string[],
  sample: Record<string, unknown>[],
  apiKey: string,
  model = 'gpt-4o-mini'
): Promise<AiMappingResult> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'Responda apenas JSON valido.' },
        { role: 'user', content: buildPrompt(headers, sample) },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  return { mapping: sanitizeAiMapping(parsed, headers) };
};

export default suggestMappingWithAi;
