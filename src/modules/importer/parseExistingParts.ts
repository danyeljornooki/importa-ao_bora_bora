/**
 * parseExistingParts.ts
 *
 * Parser para upload de existingParts via JSON.
 * Valida formato de array de inventory_items do Mongo.
 */

export interface ParsedExistingParts {
  items: unknown[];
  count: number;
  source: 'uploaded';
}

/**
 * Parse JSON file containing array of existing parts (Mongo inventory_items).
 *
 * @param file File object from input
 * @returns ParsedExistingParts with validated items array
 * @throws Error if JSON is invalid or not an array
 */
export async function parseExistingParts(file: File): Promise<ParsedExistingParts> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    // Validate is array
    if (!Array.isArray(parsed)) {
      throw new Error('Arquivo existingParts inválido.');
    }

    // Filter out non-object items
    const items = parsed.filter((item) => typeof item === 'object' && item !== null);

    if (items.length === 0) {
      throw new Error('Arquivo existingParts inválido.');
    }

    return {
      items,
      count: items.length,
      source: 'uploaded',
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Arquivo existingParts inválido.');
    }
    if (error instanceof Error && error.message === 'Arquivo existingParts inválido.') {
      throw error;
    }
    throw new Error('Arquivo existingParts inválido.');
  }
}
