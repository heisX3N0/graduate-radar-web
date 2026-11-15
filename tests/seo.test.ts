// SEO helpers: page titles, descriptions, JobPosting structured data, similar listings.
import { describe, expect, it } from 'vitest';
import type { JobListing, TrainingListing } from '../src/data/feed.ts';
import {
  jobDescription,
  jobPostingJsonLd,
  jobTitle,
  similarListings,
  trainingTitle,
} from '../src/lib/seo.ts';

const TODAY = '2026-11-15';
const SITE = 'https://graduate-radar.pages.dev';

const job = (over: Partial<JobListing> = {}): JobListing => ({
  key: 'deloitte|cyber|2026',
  slug: 'deloitte-cyber-2026',
  firstSeen: '2026-11-14',
  organisation: 'Deloitte Nigeria',
  title: 'Deloitte Academy - Cyber Security Programme',
  type: 'Graduate Trainee',
  field: 'Tech',
  location: 'Lagos',
  remote: false,
  eligibility: '2:1 in Computer Science or related',
  minClass: '2:1',
  maxAge: '26',
  nysc: 'Required done',
  deadline: '2026-11-27',
  applyLink: 'https://jobs.example.com/1',
  verifiedOn: '2026-11-14',
  status: 'Open',
  notes: '24-month programme',
  ...over,
});

describe('jobPostingJsonLd: never for closed listings', () => {
  it('is null when the sheet says Closed, even with a future deadline', () => {
    expect(jobPostingJsonLd(job({ status: 'Closed' }), SITE, TODAY)).toBeNull();
  });

  it('is null when the deadline has passed, whatever the sheet says', () => {
    expect(jobPostingJsonLd(job({ deadline: '2026-11-14' }), SITE, TODAY)).toBeNull();
  });
});

describe('jobPostingJsonLd: always valid dates and places', () => {
  it('falls back to the checked date when first seen is empty', () => {
    expect(jobPostingJsonLd(job({ firstSeen: '' }), SITE, TODAY)!['datePosted']).toBe('2026-11-14');
  });

  it('is null when there is no real date to post it under', () => {
    expect(jobPostingJsonLd(job({ firstSeen: '', verifiedOn: '' }), SITE, TODAY)).toBeNull();
  });

  it.each([
    ['Onitsha, Anambra (listed as Lagos)', 'Onitsha, Anambra'],
    ['Lagos (Ikeja), then plants nationwide', 'Lagos, then plants nationwide'],
    ['Nigeria (location not stated)', undefined],
    ['Not stated', undefined],
  ])('turns location %j into locality %j', (location, locality) => {
    const ld = jobPostingJsonLd(job({ location }), SITE, TODAY)!;
    const address = (ld['jobLocation'] as { address: Record<string, string> }).address;
    expect(address['addressLocality']).toBe(locality);
    expect(address['addressCountry']).toBe('NG');
  });
});

describe('jobPostingJsonLd: happy path', () => {
  it('has the fields Google asks for, with validThrough from the deadline', () => {
    const ld = jobPostingJsonLd(job(), SITE, TODAY)!;
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Deloitte Academy - Cyber Security Programme',
      datePosted: '2026-11-14',
      validThrough: '2026-11-27T23:59:59+01:00',
      employmentType: 'FULL_TIME',
      hiringOrganization: { '@type': 'Organization', name: 'Deloitte Nigeria' },
      jobLocation: {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressLocality: 'Lagos', addressCountry: 'NG' },
      },
      url: `${SITE}/jobs/deloitte-cyber-2026`,
      directApply: false,
    });
    expect(ld['description']).toContain('2:1 in Computer Science');
  });

  it('leaves out validThrough for Rolling or unstated deadlines', () => {
    expect(jobPostingJsonLd(job({ deadline: 'Rolling' }), SITE, TODAY)).not.toHaveProperty(
      'validThrough',
    );
    expect(jobPostingJsonLd(job({ deadline: 'Not stated' }), SITE, TODAY)).not.toHaveProperty(
      'validThrough',
    );
  });

  it('marks remote jobs as telecommute, open to applicants in Nigeria', () => {
    const ld = jobPostingJsonLd(job({ remote: true, location: 'Remote (EMEA)' }), SITE, TODAY)!;
    expect(ld).toMatchObject({
      jobLocationType: 'TELECOMMUTE',
      applicantLocationRequirements: { '@type': 'Country', name: 'Nigeria' },
    });
  });

  it('maps internships to INTERN', () => {
    expect(jobPostingJsonLd(job({ type: 'Internship' }), SITE, TODAY)!['employmentType']).toBe(
      'INTERN',
    );
  });
});

describe('titles and descriptions', () => {
  it('job title: title · organisation · closing date', () => {
    expect(jobTitle(job(), TODAY)).toBe(
      'Deloitte Academy - Cyber Security Programme · Deloitte Nigeria · Closes 27 Nov',
    );
  });

  it('says Closed in the title of a closed listing', () => {
    expect(jobTitle(job({ deadline: '2026-11-01' }), TODAY)).toContain('· Closed');
  });

  it('description names the organisation, type, location and requirements', () => {
    const d = jobDescription(job(), TODAY);
    expect(d).toContain('Deloitte Nigeria');
    expect(d).toContain('Graduate Trainee');
    expect(d).toContain('Lagos');
    expect(d).toContain('2:1 or above');
    expect(d.length).toBeLessThanOrEqual(160);
  });

  it('training title uses the provider', () => {
    const t = {
      title: 'AI Essentials',
      provider: 'Google',
      deadline: 'Rolling',
      status: 'Open',
    } as TrainingListing;
    expect(trainingTitle(t, TODAY)).toBe('AI Essentials · Google · Rolling deadline');
  });
});

describe('similarListings', () => {
  const all = [
    job(),
    job({ key: 'b', slug: 'b', field: 'Tech', deadline: '2026-11-20' }),
    job({ key: 'c', slug: 'c', field: 'Finance' }),
    job({ key: 'd', slug: 'd', field: 'Tech', status: 'Closed' }),
    job({ key: 'e', slug: 'e', field: 'Tech', deadline: '2026-11-01' }),
    job({ key: 'f', slug: 'f', field: 'Tech', deadline: '2026-11-30' }),
    job({ key: 'g', slug: 'g', field: 'Tech', deadline: '2026-12-30' }),
    job({ key: 'h', slug: 'h', field: 'Tech', deadline: 'Rolling' }),
  ];

  it('never includes itself or anything closed, and stops at 3', () => {
    const s = similarListings(all[0]!, all, TODAY, (j) => j.field);
    expect(s.map((j) => j.key)).toEqual(['b', 'f', 'g']);
  });

  it('falls back to other open listings when nothing shares the group', () => {
    const lonely = job({ key: 'z', slug: 'z', field: 'Sales & Ops' });
    const s = similarListings(lonely, [lonely, ...all], TODAY, (j) => j.field);
    expect(s).toHaveLength(3);
    expect(s.every((j) => j.key !== 'z' && j.status !== 'Closed')).toBe(true);
  });
});
