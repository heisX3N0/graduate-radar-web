// GR-011: the site and its docs must not promise an update schedule (owner decision,
// 15 Nov 2026), so a move to a daily sweep needs no copy change.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findScheduleClaims } from '../scripts/check-schedule.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'schedule-check-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function file(path: string, text: string) {
  const full = join(root, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, text);
}

describe('findScheduleClaims: what must be refused', () => {
  it('fails "Updated every Tuesday and Friday" in a component, with file and line', () => {
    file('src/components/Hero.astro', '<p>\n  Updated every Tuesday and Friday.\n</p>');
    expect(findScheduleClaims(root)).toEqual([{ file: 'src/components/Hero.astro', line: 2 }]);
  });

  it('fails "Tue/Fri" and "Tue and Fri" in the README', () => {
    file('README.md', 'Claude sweep (Tue/Fri 05:41)\nRuns Tue and Fri.');
    expect(findScheduleClaims(root)).toEqual([
      { file: 'README.md', line: 1 },
      { file: 'README.md', line: 2 },
    ]);
  });

  it('fails "twice a week" in the spec', () => {
    file('docs/build-spec.md', 'The sheet changes twice a week.');
    expect(findScheduleClaims(root)).toEqual([{ file: 'docs/build-spec.md', line: 1 }]);
  });

  it('fails a schedule line inside a launch draft', () => {
    file('docs/launch.md', '```text\nNew openings are added every Friday.\n```');
    expect(findScheduleClaims(root)).toEqual([{ file: 'docs/launch.md', line: 2 }]);
  });

  it('fails a claim split across a line break in a component', () => {
    file('src/components/EmptyState.astro', 'We add openings every Tuesday and\n    Friday.');
    expect(findScheduleClaims(root)).toEqual([
      { file: 'src/components/EmptyState.astro', line: 1 },
    ]);
  });

  it('fails the stamp on the sharing image source', () => {
    file('scripts/og/og.html', '<span class="stamp">Updated Tuesday and Friday</span>');
    expect(findScheduleClaims(root)).toEqual([{ file: 'scripts/og/og.html', line: 1 }]);
  });

  it('fails other wordings: "on Tuesdays", "each Friday", "every morning"', () => {
    file('src/pages/a.astro', '<p>New openings on Tuesdays.</p>\n<p>Checked each Friday.</p>');
    file('docs/launch.md', 'The website updates every morning.');
    expect(findScheduleClaims(root)).toEqual([
      { file: 'docs/launch.md', line: 1 },
      { file: 'src/pages/a.astro', line: 1 },
      { file: 'src/pages/a.astro', line: 2 },
    ]);
  });

  it('fails a claim with markup inside it', () => {
    file('src/components/Hero.astro', '<p>Updated every <strong>Tuesday</strong>.</p>');
    expect(findScheduleClaims(root)).toEqual([{ file: 'src/components/Hero.astro', line: 1 }]);
  });
});

describe('findScheduleClaims: what is allowed', () => {
  it('does not fail a weekday on its own', () => {
    file('src/pages/about.astro', '<p>Interviews hold on Friday. Sat and fried rice.</p>');
    expect(findScheduleClaims(root)).toEqual([]);
  });

  it('skips the snapshot, which is sheet data, not our copy', () => {
    file('src/data/snapshot.json', '{"notes": "Interviews hold every Friday"}');
    expect(findScheduleClaims(root)).toEqual([]);
  });

  it('skips build folders inside scanned folders', () => {
    file('public/dist/x.html', 'Updated every Tuesday');
    file('src/node_modules/x.js', 'Updated every Tuesday');
    expect(findScheduleClaims(root)).toEqual([]);
  });

  it('skips history and other docs: done.md, BACKLOG.md and docs not in scope', () => {
    file('docs/done.md', 'Updated every Tuesday and Friday.');
    file('BACKLOG.md', 'Updated every Tuesday and Friday.');
    file('docs/infra-capacity.md', 'The sweep runs twice a week.');
    expect(findScheduleClaims(root)).toEqual([]);
  });

  it('passes copy with no schedule', () => {
    file(
      'src/components/Footer.astro',
      '<p>We add new openings and mark closed ones as we find them.</p>',
    );
    file('README.md', 'Claude sweep (scheduled) -> Google Sheet');
    expect(findScheduleClaims(root)).toEqual([]);
  });
});

describe('the repo', () => {
  it('has no schedule claim in the site, the launch drafts, README or spec', () => {
    expect(findScheduleClaims(join(import.meta.dirname, '..'))).toEqual([]);
  });
});
