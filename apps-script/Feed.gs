// Feed.gs: Graduate Radar public feed (GR-002).
//
// Source of truth is the sheet's bound Apps Script project (Extensions > Apps Script).
// This file is a copy kept in the repo so it can be tested; keep the two in sync.
// Spec: docs/build-spec.md section 5. Public route: docs/public-routes.md.
//
// Rules:
// - Only headers listed in FEED_TABS leave the sheet (allowlist). "Found via" and the
//   private tabs are never read.
// - Columns are found by header name, never by position.
// - Apply links must be https, http or mailto.
// - Dates leave as yyyy-MM-dd in Lagos time, or "Rolling" / "Not stated", or ''.

const FEED_TABS = {
  jobs: {
    sheet: 'Jobs',
    fields: {
      Key: 'key',
      'First seen': 'firstSeen',
      Organisation: 'organisation',
      'Role / Programme': 'title',
      Type: 'type',
      Field: 'field',
      Location: 'location',
      Remote: 'remote',
      Eligibility: 'eligibility',
      'Min class': 'minClass',
      'Max age': 'maxAge',
      NYSC: 'nysc',
      Deadline: 'deadline',
      'Apply link': 'applyLink',
      'Verified on': 'verifiedOn',
      Status: 'status',
      Notes: 'notes',
    },
  },
  trainings: {
    sheet: 'Trainings & Scholarships',
    fields: {
      Key: 'key',
      'First seen': 'firstSeen',
      Provider: 'provider',
      Programme: 'title',
      Track: 'track',
      Cost: 'cost',
      Format: 'format',
      Duration: 'duration',
      Eligibility: 'eligibility',
      'Job placement?': 'jobPlacement',
      Deadline: 'deadline',
      'Apply link': 'applyLink',
      'Verified on': 'verifiedOn',
      Status: 'status',
      Notes: 'notes',
    },
  },
};
const REQUIRED_HEADERS = ['Key', 'Apply link', 'Status'];
const DATE_HEADERS = ['First seen', 'Deadline', 'Verified on'];
const ALLOWED_LINK = /^(https?:\/\/|mailto:)/i;
const TZ = 'Africa/Lagos';
const CLOSED_KEEP_DAYS = 60;
const CACHE_SECONDS = 600;
const CACHE_MAX_CHARS = 95000; // CacheService values are limited to about 100 KB

function doGet() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('feed');
  if (cached) return asJson_(cached);

  const out = { generatedAt: new Date().toISOString() };
  Object.keys(FEED_TABS).forEach((name) => {
    out[name] = readTab_(FEED_TABS[name]);
  });
  const body = JSON.stringify(out);
  if (body.length < CACHE_MAX_CHARS) cache.put('feed', body, CACHE_SECONDS);
  return asJson_(body);
}

function readTab_(cfg) {
  const sh = SpreadsheetApp.getActive().getSheetByName(cfg.sheet);
  if (!sh) {
    console.error('Feed: missing tab ' + cfg.sheet);
    return [];
  }
  const range = sh.getDataRange();
  const values = range.getDisplayValues();
  const raw = range.getValues(); // real Date objects for date cells
  const header = values[0].map((h) => String(h).trim());
  const col = {};
  header.forEach((h, i) => {
    if (cfg.fields[h]) col[h] = i;
  });
  const missing = REQUIRED_HEADERS.filter((h) => col[h] === undefined);
  if (missing.length) {
    console.error('Feed: missing required header(s) ' + missing.join(', ') + ' in ' + cfg.sheet);
    return [];
  }

  // yyyy-MM-dd strings compare correctly as text.
  const cutoff = Utilities.formatDate(
    new Date(Date.now() - CLOSED_KEEP_DAYS * 864e5),
    TZ,
    'yyyy-MM-dd',
  );
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const get = (h) => {
      if (col[h] === undefined) return '';
      if (DATE_HEADERS.indexOf(h) !== -1) return day_(raw[r][col[h]], values[r][col[h]]);
      return String(values[r][col[h]]).trim();
    };
    const status = get('Status');
    if (!get('Key') || !ALLOWED_LINK.test(get('Apply link'))) continue;
    if (status === 'Closed') {
      const verified = get('Verified on');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(verified) || verified < cutoff) continue;
    } else if (status !== 'Open' && status !== 'Closing soon') {
      continue;
    }
    const item = {};
    Object.keys(cfg.fields).forEach((h) => {
      item[cfg.fields[h]] = get(h);
    });
    if ('remote' in item) item.remote = item.remote.toLowerCase() === 'yes';
    rows.push(item);
  }
  return rows;
}

// Normalise a date field to yyyy-MM-dd in Lagos time. Keeps the words the sweep
// writes for deadlines ("Rolling", "Not stated"); returns '' for anything else.
function day_(rawValue, display) {
  if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
    return Utilities.formatDate(rawValue, TZ, 'yyyy-MM-dd');
  }
  const s = String(display).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s === 'Rolling' || s === 'Not stated') return s;
  return '';
}

function asJson_(body) {
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

// Rebuild the site daily so expired listings drop off and sweep results go live.
// Wired up in GR-008: set DEPLOY_HOOK_URL in Script Properties, then run
// installRebuildTrigger() once.
function triggerRebuild() {
  const url = PropertiesService.getScriptProperties().getProperty('DEPLOY_HOOK_URL');
  if (!url) throw new Error('Set DEPLOY_HOOK_URL in Script Properties');
  CacheService.getScriptCache().remove('feed');
  UrlFetchApp.fetch(url, { method: 'post', muteHttpExceptions: true });
}

function installRebuildTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'triggerRebuild')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('triggerRebuild').timeBased().everyDays(1).atHour(7).nearMinute(30).create();
}
