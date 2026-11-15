// Build-time data for the list pages: what goes into the page for the browser script.
import { describe, expect, it } from 'vitest';
import type { JobListing, TrainingListing } from '../src/data/feed.ts';
import { jsonForScript, toJobItem, toTrainingItem } from '../src/lib/list-data.ts';

const job: JobListing = {
  key: 'k',
  slug: 's',
  firstSeen: '2026-11-14',
  organisation: 'Org',
  title: 'Role',
  type: 'Graduate Trainee',
  field: 'Tech',
  location: 'Lagos',
  remote: false,
  eligibility: 'Any',
  minClass: '2:1',
  maxAge: '26',
  nysc: 'Required done',
  deadline: '2026-11-27',
  applyLink: 'https://x.example.com',
  verifiedOn: '2026-11-14',
  status: 'Open',
  notes: 'internal notes',
};

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const SAMPLE = `a${LS}b${PS}c`;
const SEPS = new RegExp(`[${LS}${PS}]`);

describe('jsonForScript: what must never break out of the data block', () => {
  it('escapes </script> and HTML comment openers in listing text', () => {
    const out = jsonForScript({ title: '</script><script>alert(1)</script><!--' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<!--');
    expect(JSON.parse(out)).toEqual({ title: '</script><script>alert(1)</script><!--' });
  });

  it('escapes line and paragraph separators', () => {
    const out = jsonForScript({ t: SAMPLE });
    expect(out).not.toMatch(SEPS);
    expect(JSON.parse(out)).toEqual({ t: SAMPLE });
  });
});

describe('the browser gets only what filtering and search need', () => {
  it('job items leave out the Apply link, notes, age and NYSC', () => {
    const item = toJobItem(job);
    expect(Object.keys(item).sort()).toEqual(
      [
        'deadline',
        'eligibility',
        'field',
        'firstSeen',
        'key',
        'location',
        'minClass',
        'organisation',
        'remote',
        'status',
        'title',
        'type',
      ].sort(),
    );
  });

  it('training items keep provider, track, cost, format and placement', () => {
    const t: TrainingListing = {
      key: 'k',
      slug: 's',
      firstSeen: '2026-11-10',
      provider: 'P',
      title: 'T',
      track: 'AI',
      cost: 'Free',
      format: 'Online',
      duration: '4 weeks',
      eligibility: '',
      jobPlacement: 'Yes',
      deadline: 'Rolling',
      applyLink: 'https://x.example.com',
      verifiedOn: '2026-11-12',
      status: 'Open',
      notes: 'n',
    };
    expect(toTrainingItem(t)).toEqual({
      key: 'k',
      title: 'T',
      provider: 'P',
      track: 'AI',
      cost: 'Free',
      format: 'Online',
      jobPlacement: 'Yes',
      eligibility: '',
      status: 'Open',
      deadline: 'Rolling',
      firstSeen: '2026-11-10',
    });
  });
});
