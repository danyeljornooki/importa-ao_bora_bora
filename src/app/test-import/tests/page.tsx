'use client'

import React, { useEffect, useState } from 'react';
import { matchPart } from '../../../core/importer/matching/matchPart';
import { buildInventoryIndex } from '../../../core/importer/matching/buildInventoryIndex';
import { comparePart } from '../../../core/importer/compare/comparePart';
import type { PartCanonical } from '../../../modules/importer/schemas/part.schema';
import type { ExistingInventoryItem } from '../../../types/inventory.types';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const runTests = (): { name: string; ok: boolean; error?: string }[] => {
  const results: any[] = [];

  const existing: ExistingInventoryItem[] = [
    {
      id: '1',
      store_id: 'store-1',
      code: '16675',
      price: 100,
      stock_quantity: 1,
      marketplace_name: 'engrenagem motor partida XRE 300',
      id_string: 'MLB6415626624',
      id_int: 5001,
      deleted: false,
    },
    {
      id: '2',
      store_id: 'store-1',
      code: '2846',
      price: 499,
      stock_quantity: 3,
      marketplace_name: 'Modulo Injecao Gol 1.0 Turbo',
      id_string: 'MLB6193267158',
      id_int: 5002,
      deleted: false,
    },
    {
      id: '3',
      store_id: 'store-1',
      code: 'DEL',
      price: 1,
      stock_quantity: 1,
      marketplace_name: 'Deletado',
      id_int: 9999,
      deleted: true,
    },
  ];

  const index = buildInventoryIndex(existing);

  try {
    const r = matchPart({ id_int: '5001', code: 'X', price: 1, stock_quantity: 1 } as any, index);
    assert(r.action === 'update' && r.matchedBy === 'id_int' && r.existingPart?.id === '1', 'id_int match failed');
    results.push({ name: 'priority id_int', ok: true });
  } catch (e: any) { results.push({ name: 'priority id_int', ok: false, error: e.message }); }

  try {
    const r = matchPart({ code: '16675', price: 1, stock_quantity: 1 } as any, index);
    assert(r.action === 'update' && r.matchedBy === 'code', 'code match failed');
    results.push({ name: 'fallback code', ok: true });
  } catch (e: any) { results.push({ name: 'fallback code', ok: false, error: e.message }); }

  try {
    const r = matchPart({ mlb_ids: ['MLB6415626624'], price: 1, stock_quantity: 1 } as any, index);
    assert(r.action === 'update' && r.matchedBy === 'mlb_id', 'mlb match failed');
    results.push({ name: 'fallback mlb/id_string', ok: true });
  } catch (e: any) { results.push({ name: 'fallback mlb/id_string', ok: false, error: e.message }); }

  try {
    const r = matchPart({ code: 'DEL', price: 1, stock_quantity: 1 } as any, index);
    assert(r.action === 'create', 'deleted status ignored failed');
    results.push({ name: 'deleted ignored', ok: true });
  } catch (e: any) { results.push({ name: 'deleted ignored', ok: false, error: e.message }); }

  try {
    const r = matchPart({ title: '  ENGRENAGEM MOTOR PARTIDA xre 300  ', price: 1, stock_quantity: 1 } as any, index);
    assert(r.action === 'conflict' && r.matchedBy === 'title', 'exact normalized title should conflict');
    results.push({ name: 'exact normalized title conflicts', ok: true });
  } catch (e: any) { results.push({ name: 'exact normalized title conflicts', ok: false, error: e.message }); }

  try {
    const r = matchPart({ title: 'engrenagem motor', price: 1, stock_quantity: 1 } as any, index);
    assert(
      r.action === 'create' &&
      r.matchedBy === null &&
      r.titleCandidate?.id === '1' &&
      r.warnings.includes('possível título semelhante encontrado'),
      'partial title should create with warning'
    );
    results.push({ name: 'partial title creates with warning', ok: true });
  } catch (e: any) { results.push({ name: 'partial title creates with warning', ok: false, error: e.message }); }

  try {
    const r = matchPart({ title: 'unique random title', price: 1, stock_quantity: 1 } as any, index);
    assert(r.action === 'create', 'no identifier should create');
    results.push({ name: 'no identifiers create', ok: true });
  } catch (e: any) { results.push({ name: 'no identifiers create', ok: false, error: e.message }); }

  const nineExisting: ExistingInventoryItem[] = Array.from({ length: 9 }, (_, idx) => {
    const n = idx + 1;
    return {
      id: String(n),
      store_id: 'store-1',
      id_int: 1000 + n,
      code: `CODE-${n}`,
      id_string: `MLB900${n}`,
      marketplace_name: `Peca congelada ${n}`,
      price: 100 + n,
      stock_quantity: n,
      deleted: false,
    };
  });

  const nineIncoming: PartCanonical[] = nineExisting.map((item) => ({
    id_int: item.id_int,
    code: item.code,
    mlb_ids: item.id_string ? [item.id_string] : undefined,
    title: item.marketplace_name ?? undefined,
    price: item.price ?? 0,
    stock_quantity: item.stock_quantity ?? null,
  }));

  const summarize = (parts: PartCanonical[]) => {
    const frozenIndex = buildInventoryIndex(nineExisting);
    const summary = { creates: 0, updates: 0, skipped: 0, conflicts: 0, invalid: 0 };

    for (const part of parts) {
      const match = matchPart(part, frozenIndex);
      if (match.action === 'create') {
        summary.creates += 1;
      } else if (match.action === 'conflict') {
        summary.conflicts += 1;
      } else if (match.existingPart) {
        const comparison = comparePart(part, match.existingPart as any);
        if (comparison.changed) summary.updates += 1;
        else summary.skipped += 1;
      }
    }

    return summary;
  };

  try {
    const summary = summarize(nineIncoming);
    assert(summary.creates === 0 && summary.updates === 0 && summary.skipped === 9 && summary.conflicts === 0 && summary.invalid === 0, 'same spreadsheet should skip 9');
    results.push({ name: 'acceptance same spreadsheet skips 9', ok: true });
  } catch (e: any) { results.push({ name: 'acceptance same spreadsheet skips 9', ok: false, error: e.message }); }

  try {
    const changed = nineIncoming.map((part, idx) => idx === 0 ? { ...part, price: (part.price ?? 0) + 1 } : part);
    const summary = summarize(changed);
    assert(summary.creates === 0 && summary.updates === 1 && summary.skipped === 8, 'one price change should update 1 skip 8');
    results.push({ name: 'acceptance one price change updates 1', ok: true });
  } catch (e: any) { results.push({ name: 'acceptance one price change updates 1', ok: false, error: e.message }); }

  try {
    const summary = summarize([...nineIncoming, { code: 'NEW', title: 'Peca nova', price: 1, stock_quantity: 1 }]);
    assert(summary.creates === 1 && summary.updates === 0 && summary.skipped === 9, 'new part should create 1 skip 9');
    results.push({ name: 'acceptance new part creates 1', ok: true });
  } catch (e: any) { results.push({ name: 'acceptance new part creates 1', ok: false, error: e.message }); }

  try {
    const r = matchPart({ code: 'CODE-1', price: 101, stock_quantity: 1 } as any, buildInventoryIndex(nineExisting));
    assert(r.action === 'update' && r.matchedBy === 'code', 'missing id_int should match by code');
    results.push({ name: 'acceptance missing id_int matches code', ok: true });
  } catch (e: any) { results.push({ name: 'acceptance missing id_int matches code', ok: false, error: e.message }); }

  try {
    const r = matchPart({ mlb_ids: ['MLB9001'], price: 101, stock_quantity: 1 } as any, buildInventoryIndex(nineExisting));
    assert(r.action === 'update' && r.matchedBy === 'mlb_id', 'missing id_int/code should match by mlb');
    results.push({ name: 'acceptance missing id/code matches mlb', ok: true });
  } catch (e: any) { results.push({ name: 'acceptance missing id/code matches mlb', ok: false, error: e.message }); }

  try {
    const r = matchPart({ title: 'Peca congelada', price: 1, stock_quantity: 1 } as any, buildInventoryIndex(nineExisting));
    assert(
      r.action === 'create' &&
      r.matchedBy === null &&
      r.warnings.includes('possível título semelhante encontrado'),
      'title-only similar should create with warning'
    );
    results.push({ name: 'acceptance title-only similar creates', ok: true });
  } catch (e: any) { results.push({ name: 'acceptance title-only similar creates', ok: false, error: e.message }); }

  return results;
};

export default function TestPage() {
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    setResults(runTests());
  }, []);

  return (
    <main style={{ padding: 12 }}>
      <h1>Integration Parity Tests (match)</h1>
      <ul>
        {results.map((r, i) => (
          <li key={i} style={{ color: r.ok ? 'green' : 'red' }}>
            {r.name}: {r.ok ? 'OK' : `FAIL - ${r.error}`}
          </li>
        ))}
      </ul>
    </main>
  );
}
