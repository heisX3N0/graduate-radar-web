// The feed contract (spec section 5.3), checked with Zod. Fields not listed here are
// stripped on parse, so a field that leaks from the sheet (for example "Found via")
// can never reach a page.
import { z } from 'astro/zod';

const day = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'yyyy-MM-dd or empty');
const deadline = z.union([day, z.literal('Rolling'), z.literal('Not stated')]);
const status = z.enum(['Open', 'Closing soon', 'Closed']);

export const JobSchema = z.object({
  key: z.string().min(1),
  firstSeen: day,
  organisation: z.string(),
  title: z.string(),
  type: z.string(),
  field: z.string(),
  location: z.string(),
  remote: z.boolean(),
  eligibility: z.string(),
  minClass: z.string(),
  maxAge: z.string(),
  nysc: z.string(),
  deadline,
  applyLink: z.string(),
  verifiedOn: day,
  status,
  notes: z.string(),
});

export const TrainingSchema = z.object({
  key: z.string().min(1),
  firstSeen: day,
  provider: z.string(),
  title: z.string(),
  track: z.string(),
  cost: z.string(),
  format: z.string(),
  duration: z.string(),
  eligibility: z.string(),
  jobPlacement: z.string(),
  deadline,
  applyLink: z.string(),
  verifiedOn: day,
  status,
  notes: z.string(),
});

export const FeedSchema = z.object({
  generatedAt: z.string(),
  jobs: z.array(JobSchema),
  trainings: z.array(TrainingSchema),
});

/** Top-level shape only: rows are checked one by one, so one bad row can be dropped alone. */
export const FeedShapeSchema = z.object({
  generatedAt: z.string(),
  jobs: z.array(z.unknown()),
  trainings: z.array(z.unknown()),
});

export type Job = z.infer<typeof JobSchema>;
export type Training = z.infer<typeof TrainingSchema>;
export type Feed = z.infer<typeof FeedSchema>;

/** Apply links must be https, http or mailto (spec section 5.1). One copy, in lib/links.ts. */
export { isAllowedLink } from '../lib/links.ts';
