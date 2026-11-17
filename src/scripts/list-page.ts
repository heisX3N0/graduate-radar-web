// Progressive enhancement for the list pages. The server renders every open listing in
// its section; this script filters, searches and sorts them in place, puts each shown row
// in its section (GR-015), keeps the filter state in the URL (so a filtered view can be
// shared on WhatsApp), and re-checks deadlines against today's date in Lagos, so a
// listing that closed since the last build disappears and one that closes today moves
// to "Closes today". It never sends anything anywhere: the search text only goes into
// this page's URL.
import { lagosToday } from '../lib/dates.ts';
import {
  filterJobs,
  filterTrainings,
  jobFiltersToQuery,
  makeJobSearch,
  makeTrainingSearch,
  openOnly,
  parseJobFilters,
  parseTrainingFilters,
  trainingFiltersToQuery,
  type JobItem,
  type Sort,
  type TrainingItem,
} from '../lib/filters.ts';
import { countText as counted } from '../lib/listing-text.ts';
import { listSections } from '../lib/sections.ts';

interface JobData {
  kind: 'jobs';
  items: JobItem[];
  options: { types: string[]; fields: string[] };
}
interface TrainingData {
  kind: 'trainings';
  items: TrainingItem[];
  options: { tracks: string[] };
}

function countText(n: number, noun: string): string {
  return n === 0 ? `No ${noun}s match` : counted(n, noun);
}

interface SectionEl {
  el: HTMLElement;
  rows: HTMLElement;
  count: HTMLElement | null;
}

export function initListPage(): void {
  const root = document.querySelector<HTMLElement>('[data-list-page]');
  const dataEl = document.getElementById('list-data');
  if (!root || !dataEl?.textContent) return;
  const data = JSON.parse(dataEl.textContent) as JobData | TrainingData;

  const form = root.querySelector<HTMLFormElement>('[data-filters]');
  const list = root.querySelector<HTMLElement>('[data-items]');
  const flat = root.querySelector<HTMLElement>('[data-flat]');
  const countRow = root.querySelector<HTMLElement>('[data-count]');
  const count = countRow?.querySelector<HTMLElement>('p');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  const more = root.querySelector<HTMLDetailsElement>('[data-more]');
  const active = root.querySelector<HTMLElement>('[data-active]');
  const clearLink = root.querySelector<HTMLElement>('.lists__clear');
  if (!form || !list || !flat) return;

  const today = lagosToday();
  const noun = data.kind === 'jobs' ? 'opening' : 'training';
  const rows = new Map<string, HTMLElement>();
  list
    .querySelectorAll<HTMLElement>('[data-key]')
    .forEach((el) => rows.set(el.dataset['key']!, el));
  const sections = new Map<string, SectionEl>();
  list.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
    const ul = el.querySelector<HTMLElement>('ul');
    if (ul) {
      sections.set(el.dataset['section']!, {
        el,
        rows: ul,
        count: el.querySelector('[data-section-count]'),
      });
    }
  });

  const search = data.kind === 'jobs' ? makeJobSearch(data.items) : makeTrainingSearch(data.items);

  // Read the controls into URL-style params, so the same parser validates both.
  const readControls = (): URLSearchParams => {
    const p = new URLSearchParams();
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input[name], select[name]',
    )) {
      if (el.value) p.set(el.name, el.value);
    }
    for (const chip of form.querySelectorAll<HTMLButtonElement>('button[data-filter]')) {
      if (chip.getAttribute('aria-pressed') === 'true') p.set(chip.dataset['filter']!, '1');
    }
    return p;
  };

  const writeControls = (p: URLSearchParams): void => {
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input[name], select[name]',
    )) {
      el.value = p.get(el.name) ?? '';
    }
    for (const chip of form.querySelectorAll<HTMLButtonElement>('button[data-filter]')) {
      chip.setAttribute('aria-pressed', p.get(chip.dataset['filter']!) === '1' ? 'true' : 'false');
    }
  };

  const rowsFor = (keys: string[]) =>
    keys.map((k) => rows.get(k)).filter((el): el is HTMLElement => !!el);

  // Put each shown row in its section (or the flat Newest list), in order. Appending an
  // existing node moves it; nothing is re-created. Sections left empty are hidden.
  const place = (items: (JobItem | TrainingItem)[], sort: Sort): void => {
    const groups = listSections(data.kind, items, sort, today);
    const flatView = sort === 'new' || sections.size === 0;
    flat.hidden = !flatView || groups[0]!.keys.length === 0;
    if (flatView) {
      flat.append(...rowsFor(groups.flatMap((g) => g.keys)));
      for (const s of sections.values()) s.el.hidden = true;
      return;
    }
    const used = new Set<string>();
    for (const g of groups) {
      const s = sections.get(g.id);
      if (!s) continue;
      used.add(g.id);
      s.rows.append(...rowsFor(g.keys));
      if (s.count) s.count.textContent = String(g.keys.length);
      s.el.hidden = g.keys.length === 0;
      list.insertBefore(s.el, flat);
    }
    for (const [id, s] of sections) if (!used.has(id)) s.el.hidden = true;
  };

  const render = (params: URLSearchParams, updateUrl: boolean): void => {
    let shown: (JobItem | TrainingItem)[];
    let sort: Sort;
    let query: string;
    if (data.kind === 'jobs') {
      const f = parseJobFilters(params, data.options);
      shown = filterJobs(data.items, f, today, search);
      sort = f.sort;
      query = jobFiltersToQuery(f);
    } else {
      const f = parseTrainingFilters(params, data.options);
      shown = filterTrainings(data.items, f, today, search);
      sort = f.sort;
      query = trainingFiltersToQuery(f);
    }
    const keys = new Set(shown.map((i) => i.key));
    for (const [key, el] of rows) el.hidden = !keys.has(key);
    place(shown, sort);
    if (count) count.textContent = countText(keys.size, noun);
    if (empty) empty.hidden = keys.size > 0;
    // "(2 on)" beside "Filters": filters in use, not counting search or sort.
    const on = [...new URLSearchParams(query).keys()].filter(
      (k) => k !== 'q' && k !== 'sort',
    ).length;
    if (active) active.textContent = on > 0 ? `(${on} on)` : '';
    // The result line and "Clear filters" show only when a filter or search is in use;
    // otherwise the line stays for screen readers only.
    const filtered = on > 0 || !!params.get('q');
    countRow?.classList.toggle('visually-hidden', !filtered);
    if (clearLink) clearLink.hidden = !filtered;
    if (updateUrl) history.replaceState(null, '', `${location.pathname}${query}${location.hash}`);
  };

  // The heading's count was set at build; listings may have closed since.
  // The heading and, from 960 px, the masthead date line both carry the count (GR-017).
  const totals = document.querySelectorAll<HTMLElement>('[data-total]');
  const allItems: readonly (JobItem | TrainingItem)[] = data.items;
  const totalText = counted(openOnly(allItems, today).length, noun);
  totals.forEach((t) => (t.textContent = totalText));

  const initial = new URLSearchParams(location.search);
  writeControls(initial);
  // Open the filters when a shared link arrives with filters set (not just a search).
  const known = [...readControls().keys()].some((k) => k !== 'q');
  if (more && known) more.open = true;
  // Clean the URL of anything unknown or malformed (an old "soon=1" too) on first load.
  render(readControls(), true);

  let timer: number | undefined;
  form.addEventListener('input', (e) => {
    const isText = (e.target as HTMLElement).matches('input[type="search"]');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => render(readControls(), true), isText ? 150 : 0);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    render(readControls(), true);
  });
  form.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-filter]');
    if (!chip) return;
    chip.setAttribute(
      'aria-pressed',
      chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true',
    );
    render(readControls(), true);
  });
  root.querySelectorAll<HTMLAnchorElement>('[data-clear] a, a[data-clear]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      writeControls(new URLSearchParams());
      render(new URLSearchParams(), true);
      form.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    }),
  );
}
