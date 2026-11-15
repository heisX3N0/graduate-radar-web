// Stable page addresses for listings (spec section 6.1). Build time only (uses node:crypto).
//
// A listing's slug depends only on its own key and the keys that share its plain slug,
// so adding, removing or reordering other rows never moves a listing to another URL.
import { createHash } from 'node:crypto';

/** lowercase, accents dropped, every run of non-alphanumerics becomes one "-", trimmed. */
export function slugify(key: string): string {
  return key
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hash(key: string, length: number): string {
  return createHash('sha1').update(key, 'utf8').digest('hex').slice(0, length);
}

/**
 * Maps each key to a unique slug. Keys whose plain slugs collide (or are empty) all get
 * "-" plus the start of a SHA-1 of the full key. If a plain slug happens to equal one of
 * those suffixed slugs, the plain one is suffixed too, so suffixed slugs never move.
 */
export function assignSlugs(keys: readonly string[]): Map<string, string> {
  const unique = [...new Set(keys)];
  const plain = new Map(unique.map((k) => [k, slugify(k)] as const));

  const byPlain = new Map<string, string[]>();
  for (const [k, s] of plain) byPlain.set(s, [...(byPlain.get(s) ?? []), k]);

  const suffixed = new Set<string>();
  for (const [s, group] of byPlain)
    if (s === '' || group.length > 1) group.forEach((k) => suffixed.add(k));

  // Plain slugs that equal a suffixed slug must be suffixed as well. Repeat until stable.
  let length = 6;
  for (;;) {
    const result = new Map<string, string>();
    for (const k of unique) {
      const base = plain.get(k) || 'listing';
      result.set(k, suffixed.has(k) ? `${base}-${hash(k, length)}` : base);
    }
    const owners = new Map<string, string[]>();
    for (const [k, s] of result) owners.set(s, [...(owners.get(s) ?? []), k]);
    const clashes = [...owners.values()].filter((g) => g.length > 1);
    if (clashes.length === 0) return result;

    let changed = false;
    for (const group of clashes) {
      for (const k of group) {
        if (!suffixed.has(k)) {
          suffixed.add(k);
          changed = true;
        }
      }
    }
    // Only suffixed slugs clash (two hashes share a prefix): lengthen every hash.
    if (!changed) length += 2;
    if (length > 40) throw new Error('assignSlugs: could not make slugs unique');
  }
}
