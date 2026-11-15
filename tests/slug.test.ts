import { describe, expect, it } from 'vitest';
import { assignSlugs, slugify } from '../src/lib/slug.ts';

describe('slugify', () => {
  it('matches the spec example', () => {
    expect(slugify('deloitte nigeria|deloitte academy - cyber security programme|2026')).toBe(
      'deloitte-nigeria-deloitte-academy-cyber-security-programme-2026',
    );
  });

  it('lowercases, collapses repeats and trims separators', () => {
    expect(slugify('  MTN  Nigeria||Graduate  Trainee!!|2026  ')).toBe(
      'mtn-nigeria-graduate-trainee-2026',
    );
  });

  it('drops accents rather than whole letters', () => {
    expect(slugify('société générale|stagiaire|2026')).toBe('societe-generale-stagiaire-2026');
  });
});

describe('assignSlugs: collisions', () => {
  const a = 'Access Bank|Graduate Programme|2026';
  const b = 'access bank|graduate programme|2026!'; // different key, same slug text
  const c = 'zenith bank|graduate trainee|2026';

  it('gives every colliding listing a hash suffix, not just the second one', () => {
    const slugs = assignSlugs([a, b]);
    const sa = slugs.get(a)!;
    const sb = slugs.get(b)!;
    expect(sa).toMatch(/^access-bank-graduate-programme-2026-[0-9a-f]{6}$/);
    expect(sb).toMatch(/^access-bank-graduate-programme-2026-[0-9a-f]{6}$/);
    expect(sa).not.toBe(sb);
  });

  it('keeps every slug the same when the order is reversed or a listing is added', () => {
    const first = assignSlugs([a, b]);
    const reversed = assignSlugs([b, a]);
    const added = assignSlugs([c, b, a]);
    for (const key of [a, b]) {
      expect(reversed.get(key)).toBe(first.get(key));
      expect(added.get(key)).toBe(first.get(key));
    }
  });

  it('never gives two keys the same slug, even when a suffixed slug matches another natural slug', () => {
    // A third key whose plain slug is exactly the suffixed slug a would get.
    const clash = assignSlugs([a, b]).get(a)!;
    const tricky = [a, b, clash];
    const slugs = assignSlugs(tricky);
    expect(new Set(slugs.values()).size).toBe(tricky.length);
  });

  it('gives a key with no letters or digits a usable slug', () => {
    const slug = assignSlugs(['|||']).get('|||')!;
    expect(slug).toMatch(/^listing-[0-9a-f]{6}$/);
  });

  it('leaves non-colliding slugs plain', () => {
    expect(assignSlugs([a, c]).get(c)).toBe('zenith-bank-graduate-trainee-2026');
  });
});
