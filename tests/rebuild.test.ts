// The daily rebuild in Feed.gs (GR-008): triggerRebuild calls the Cloudflare deploy hook,
// installRebuildTrigger schedules it. Runs the real Feed.gs against Apps Script stand-ins.
import { describe, expect, it } from 'vitest';
import { loadFeed, type Options } from './apps-script-stubs.ts';

const HOOK = 'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/test-hook';
const tabs = { Jobs: [['Key']], 'Trainings & Scholarships': [['Key']] };
const load = (options: Options = {}) => loadFeed(tabs, options);

describe('triggerRebuild: what must fail loudly', () => {
  it('throws, and calls nothing, when DEPLOY_HOOK_URL is not set', () => {
    const h = load();
    expect(() => h.feed.triggerRebuild()).toThrow(/DEPLOY_HOOK_URL/);
    expect(h.fetches).toEqual([]);
  });

  it('refuses a hook URL that is not https on api.cloudflare.com', () => {
    for (const url of [
      'http://api.cloudflare.com/x',
      'https://evil.example.com/hook',
      'not a url',
    ]) {
      const h = load({ props: { DEPLOY_HOOK_URL: url } });
      expect(() => h.feed.triggerRebuild()).toThrow(/api\.cloudflare\.com/);
      expect(h.fetches).toEqual([]);
    }
  });

  it.each([401, 404, 429, 500])(
    'throws when Cloudflare answers %i, so the trigger shows as failed and Google emails the owner',
    (status) => {
      const h = load({ props: { DEPLOY_HOOK_URL: HOOK }, fetchStatus: status });
      expect(() => h.feed.triggerRebuild()).toThrow(new RegExp(String(status)));
    },
  );

  it('keeps the hook URL out of the error when the network call itself throws', () => {
    const h = load({ props: { DEPLOY_HOOK_URL: HOOK }, fetchThrows: true });
    let message = '';
    try {
      h.feed.triggerRebuild();
    } catch (e) {
      message = String(e);
    }
    expect(message).toMatch(/could not reach/i);
    expect(message).not.toContain('test-hook');
  });

  it('never puts the hook URL in the error message (it is a secret)', () => {
    const h = load({ props: { DEPLOY_HOOK_URL: HOOK }, fetchStatus: 500 });
    let message = '';
    try {
      h.feed.triggerRebuild();
    } catch (e) {
      message = String(e);
    }
    expect(message).not.toContain('test-hook');
  });
});

describe('triggerRebuild: happy path', () => {
  it('clears the feed cache and POSTs to the hook once', () => {
    const h = load({ props: { DEPLOY_HOOK_URL: HOOK } });
    h.cache.set('feed', 'stale');
    h.feed.triggerRebuild();
    expect(h.cache.has('feed')).toBe(false);
    expect(h.fetches).toEqual([{ url: HOOK, method: 'post' }]);
  });
});

describe('installRebuildTrigger', () => {
  it('leaves exactly one rebuild trigger when run twice', () => {
    const h = load();
    h.feed.installRebuildTrigger();
    h.feed.installRebuildTrigger();
    expect(h.triggers.filter((t) => t.handler === 'triggerRebuild')).toHaveLength(1);
  });

  it('does not touch other triggers in the project', () => {
    const h = load({ triggers: [{ handler: 'phase2Scrape' }, { handler: 'triggerRebuild' }] });
    h.feed.installRebuildTrigger();
    expect(h.triggers.map((t) => t.handler).sort()).toEqual(['phase2Scrape', 'triggerRebuild']);
  });

  it('schedules it daily at about 07:30 (script time zone, Lagos)', () => {
    const h = load();
    h.feed.installRebuildTrigger();
    expect(h.triggers).toEqual([
      { handler: 'triggerRebuild', everyDays: 1, atHour: 7, nearMinute: 30 },
    ]);
  });
});
