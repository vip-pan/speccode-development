// Strip U+000D (CR) from every string in a JSON value, recursively.
// Fast path: an input containing no CR is returned by reference.
export function stripCR(value) {
  if (typeof value === 'string') {
    return value.includes('\r') ? value.replaceAll('\r', '') : value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const r = stripCR(v);
      if (r !== v) changed = true;
      return r;
    });
    return changed ? out : value;
  }
  if (value !== null && typeof value === 'object') {
    let changed = false;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const r = stripCR(v);
      if (r !== v) changed = true;
      out[k] = r;
    }
    return changed ? out : value;
  }
  return value;
}
