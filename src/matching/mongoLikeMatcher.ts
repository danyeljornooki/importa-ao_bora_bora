type Query = Record<string, any>;

const getValueByPath = (obj: any, path: string): any => {
  if (!obj) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

const evaluateCondition = (itemValue: any, condition: any): boolean => {
  // operator $ne
  if (condition && typeof condition === 'object' && ('$ne' in condition)) {
    return itemValue !== condition['$ne'];
  }

  // nested object: descend
  if (condition && typeof condition === 'object') {
    if (itemValue == null) return false;
    for (const k of Object.keys(condition)) {
      if (!evaluateCondition(itemValue[k], condition[k])) return false;
    }
    return true;
  }

  // primitive equality
  if (typeof condition === 'string') {
    if (typeof itemValue === 'string') return itemValue === condition;
    return String(itemValue) === condition;
  }

  return itemValue === condition;
};

// Execute a mongo-like query against an array of items.
// Returns { item, matchedKey } for the first matching item, or null.
export const executeMongoLikeQuery = (items: any[], query: Query): { item: any; matchedKey: string | null } | null => {
  if (!Array.isArray(items)) return null;

  const topLevelKeys = Object.keys(query).filter((k) => k !== '$or');

  for (const item of items) {
    // check top-level constraints (e.g., status: { $ne: 'deleted' })
    let ok = true;
    for (const key of topLevelKeys) {
      const condition = query[key];
      const itemValue = getValueByPath(item, key);
      if (!evaluateCondition(itemValue, condition)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    // handle $or
    const ors = query.$or;
    if (Array.isArray(ors) && ors.length > 0) {
      for (const clause of ors) {
        // clause is an object with one key
        const clauseKey = Object.keys(clause)[0];
        const clauseCond = clause[clauseKey];
        const itemValue = getValueByPath(item, clauseKey);
        if (evaluateCondition(itemValue, clauseCond)) {
          return { item, matchedKey: clauseKey };
        }
      }
      // no clause matched
      continue;
    }

    // if no $or, and passed top-level checks, consider matched
    return { item, matchedKey: null };
  }

  return null;
};

export default executeMongoLikeQuery;
