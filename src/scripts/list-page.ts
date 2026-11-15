// Progressive enhancement for the list pages. The server renders every open listing;
// this script filters, searches and sorts them in place, keeps the filter state in the
// URL (so a filtered view can be shared on WhatsApp), and re-checks deadlines against
// today's date in Lagos so a listing that closed since the last build disappears.
// It never sends anything anywhere: the search text only goes into this page's URL.
import { lagosToday } from '../lib/dates.ts';
import { cardState } from '../lib/listing-text.ts';
import {
  filterJobs,
  filterTrainings,
  jobFiltersToQuery,
  makeJobSearch,
  makeTrainingSearch,
  parseJobFilters,
  parseTrainingFilters,
  trainingFiltersToQuery,
  type JobItem,
  type TrainingItem,
} from '../lib/filters.ts';

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

function countText(n: number): string {
  return n === 0 ? 'No openings match' : `${n} ${n === 1 ? 'opening' : 'openings'}`;
}

export function initListPage(): void {
  const root = document.querySelector<HTMLElement>('[data-list-page]');
  const dataEl = document.getElementById('list-data');
  if (!root || !dataEl?.textContent) return;
  const data = JSON.parse(dataEl.textContent) as JobData | TrainingData;

  const form = root.querySelector<HTMLFormElement>('[data-filters]');
  const list = root.querySelector<HTMLElement>('[data-items]');
  const count = root.querySelector<HTMLElement>('[data-count] p');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  const more = root.querySelector<HTMLDetailsElement>('[data-more]');
  const active = root.querySelector<HTMLElement>('[data-active]');
  const clearLink = root.querySelector<HTMLElement>('.lists__clear');
  if (!form || !list) return;

  const today = lagosToday();
  const cards = new Map<string, HTMLElement>();
  list
    .querySelectorAll<HTMLElement>('[data-key]')
    .forEach((el) => cards.set(el.dataset['key']!, el));

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

  const render = (params: URLSearchParams, updateUrl: boolean): void => {
    let keys: string[];
    let query: string;
    if (data.kind === 'jobs') {
      const f = parseJobFilters(params, data.options);
      keys = filterJobs(data.items, f, today, search).map((i) => i.key);
      query = jobFiltersToQuery(f);
    } else {
      const f = parseTrainingFilters(params, data.options);
      keys = filterTrainings(data.items, f, today, search).map((i) => i.key);
      query = trainingFiltersToQuery(f);
    }
    const shown = new Set(keys);
    for (const [key, el] of cards) el.hidden = !shown.has(key);
    // Re-order in place: appending existing nodes moves them, nothing is re-created.
    list.append(...keys.map((k) => cards.get(k)).filter((el): el is HTMLElement => !!el));
    if (count) count.textContent = countText(keys.length);
    if (empty) empty.hidden = keys.length > 0;
    // "(2 on)" beside "Filters and sort": filters in use, not counting search or sort.
    const on = [...new URLSearchParams(query).keys()].filter(
      (k) => k !== 'q' && k !== 'sort',
    ).length;
    if (active) active.textContent = on > 0 ? `(${on} on)` : '';
    // "Clear filters" beside the count only when a filter or search is in use.
    if (clearLink) clearLink.hidden = on === 0 && !params.get('q');
    if (updateUrl) history.replaceState(null, '', `${location.pathname}${query}${location.hash}`);
  };

  // "Closing this week" sits above the list (outside root): hide links whose deadline has
  // passed since the build, and the whole box when none are left.
  const strip = document.querySelector<HTMLElement>('[data-closing-soon]');
  if (strip) {
    const links = [...strip.querySelectorAll<HTMLElement>('[data-deadline]')];
    for (const el of links) if ((el.dataset['deadline'] ?? '') < today) el.hidden = true;
    if (links.every((el) => el.hidden)) strip.hidden = true;
  }

  // Cards were labelled at build time; bring "N days left" and the badges up to today.
  const items = new Map<string, JobItem | TrainingItem>(data.items.map((i) => [i.key, i]));
  for (const [key, el] of cards) {
    const item = items.get(key);
    if (!item) continue;
    const state = cardState({ ...item, remote: 'remote' in item ? item.remote : false }, today);
    const chip = el.querySelector<HTMLElement>('[data-deadline-chip]');
    if (chip) {
      const variant =
        state.deadline.kind === 'closed' ? 'closed' : state.deadline.urgent ? 'urgent' : 'calm';
      chip.classList.remove('deadline--calm', 'deadline--urgent', 'deadline--closed');
      chip.classList.add(`deadline--${variant}`);
      const text = chip.querySelector('.deadline__text');
      const sub = chip.querySelector<HTMLElement>('.deadline__sub');
      if (text) text.textContent = state.deadline.text;
      if (sub) {
        sub.textContent = state.deadline.sub;
        sub.hidden = !state.deadline.sub;
      }
    }
    const kinds = new Set(state.badges.map((b) => b.kind));
    const badgeList = el.querySelector<HTMLElement>('.card__badges');
    el.querySelectorAll<HTMLElement>('[data-badge]').forEach((b) => {
      b.hidden = !kinds.has(b.dataset['badge'] as 'soon' | 'remote' | 'new');
    });
    if (badgeList) badgeList.hidden = kinds.size === 0;
  }

  const initial = new URLSearchParams(location.search);
  writeControls(initial);
  // Show the filters on desktop, and when a shared link arrives with filters set.
  const sharedFilters = [...initial.keys()].some((k) => k !== 'q');
  if (more && (sharedFilters || window.matchMedia('(min-width: 60rem)').matches)) more.open = true;
  // Clean the URL of anything unknown or malformed on first load.
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
