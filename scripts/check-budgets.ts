// Page weight budgets (spec 6.6), checked on every built page after `astro build`:
// - JavaScript (inline and linked) at most 50 KB gzipped;
// - first load (HTML + linked CSS + linked JS) at most 150 KB gzipped.
// Cloudflare's analytics beacon is added at serve time, so it is not in dist/ and not
// counted (the spec excludes analytics). Images are not counted: the site has none in
// page content; the sharing image is fetched by WhatsApp, not by visitors.
// Run: node scripts/check-budgets.ts [dist]   (part of npm run build)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUDGET = { jsBytes: 50 * 1024, totalBytes: 150 * 1024 };

export interface Weight {
  html: number;
  css: number;
  js: number;
  total: number;
  missing: string[];
}

export interface BudgetFinding {
  file: string;
  reason: string;
}

const gz = (text: string | Buffer) => gzipSync(text, { level: 9 }).length;
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

/** Gzipped weight of one page and the CSS and JS it links to (each file once). */
export function pageWeight(dist: string, page: string): Weight {
  const htmlText = readFileSync(join(dist, page), 'utf8');
  const inlineJs = [
    ...htmlText.matchAll(
      /<script\b(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
    .map((m) => m[1] ?? '')
    .join('\n');
  // Either capture group can hold the URL (rel before href, or href before rel).
  const assets = (re: RegExp) => [
    ...new Set([...htmlText.matchAll(re)].map((m) => m[1] ?? m[2]).filter((u): u is string => !!u)),
  ];
  const scripts = assets(/<script\b[^>]*\bsrc="([^"]+)"/gi);
  const styles = assets(
    /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"|<link\b[^>]*href="([^"]+)"[^>]*rel="stylesheet"/gi,
  );
  const missing: string[] = [];
  const read = (url: string) => {
    if (/^https?:\/\//i.test(url)) return '';
    const path = join(dist, url.replace(/^\//, '').split('?')[0]!);
    if (!existsSync(path)) {
      missing.push(url);
      return '';
    }
    return readFileSync(path);
  };
  const js =
    scripts.reduce((sum, s) => sum + gz(read(s)), 0) + (inlineJs.trim() ? gz(inlineJs) : 0);
  const css = styles.reduce((sum, s) => sum + gz(read(s)), 0);
  const html = gz(htmlText);
  return { html, css, js, total: html + css + js, missing };
}

function htmlFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) htmlFiles(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

export function checkBudgets(dist: string): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  for (const full of htmlFiles(dist)) {
    const file = relative(dist, full).split(sep).join('/');
    const w = pageWeight(dist, file);
    for (const m of w.missing) findings.push({ file, reason: `links to ${m}, which is missing` });
    if (w.js > BUDGET.jsBytes) {
      findings.push({
        file,
        reason: `JavaScript ${kb(w.js)} gzipped, over the ${kb(BUDGET.jsBytes)} budget`,
      });
    }
    if (w.total > BUDGET.totalBytes) {
      findings.push({
        file,
        reason: `first load ${kb(w.total)} gzipped, over the ${kb(BUDGET.totalBytes)} budget`,
      });
    }
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = process.argv[2] ?? 'dist';
  const findings = checkBudgets(dist);
  for (const f of findings) console.error(`${f.file}: ${f.reason}`);
  const home = existsSync(join(dist, 'index.html')) ? pageWeight(dist, 'index.html') : null;
  if (home) {
    console.log(
      `Home page: HTML ${kb(home.html)}, CSS ${kb(home.css)}, JS ${kb(home.js)}, first load ${kb(home.total)} (gzipped).`,
    );
  }
  if (findings.length > 0) {
    console.error(`Budget check failed: ${findings.length} finding(s).`);
    process.exitCode = 1;
  } else {
    console.log('Budget check passed.');
  }
}
