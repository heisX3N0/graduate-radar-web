// GR-012: the site's address is graduateradar.versionphi.com, set in two places that
// must agree (astro.config.mjs for Astro.site, src/lib/site.ts for the fallback).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { absolute, canonicalPath, DEFAULT_SITE, siteOrigin } from '../src/lib/site.ts';

const ROOT = join(import.meta.dirname, '..');

afterEach(() => vi.unstubAllEnvs());

describe('the site address', () => {
  it('is not the old pages.dev address', () => {
    expect(DEFAULT_SITE).not.toMatch(/pages\.dev/);
  });

  it('astro.config.mjs takes it from src/lib/site.ts instead of repeating it', () => {
    const config = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8');
    expect(config).toMatch(/import \{ DEFAULT_SITE \} from '\.\/src\/lib\/site\.ts'/);
    expect(config).not.toMatch(/https:\/\//);
  });

  it('is graduateradar.versionphi.com', () => {
    vi.stubEnv('SITE_URL', '');
    expect(siteOrigin(undefined)).toBe('https://graduateradar.versionphi.com');
    expect(absolute(undefined, '/jobs/a')).toBe('https://graduateradar.versionphi.com/jobs/a');
  });

  it('gives the home page a canonical path of "/", never "/index" (which redirects)', () => {
    expect(canonicalPath('/index.html')).toBe('/');
    expect(canonicalPath('/index')).toBe('/');
    expect(canonicalPath('/')).toBe('/');
  });

  it('drops .html from other pages and keeps their path', () => {
    expect(canonicalPath('/trainings.html')).toBe('/trainings');
    expect(canonicalPath('/jobs/deloitte-cyber-2026.html')).toBe('/jobs/deloitte-cyber-2026');
    expect(canonicalPath('/jobs/index-fund-analyst')).toBe('/jobs/index-fund-analyst');
  });

  it('can still be overridden with SITE_URL', () => {
    vi.stubEnv('SITE_URL', 'https://preview.example.com/');
    expect(siteOrigin(undefined)).toBe('https://preview.example.com');
  });
});
