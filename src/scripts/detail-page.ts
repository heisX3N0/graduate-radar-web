// Detail pages are built once a day. This re-checks the listing against today's date in
// Lagos, so between builds the Closes row ("Fri 27 Nov, 12 days left") stays right and a
// listing whose deadline has passed shows "This opening has closed" with no Apply button.
import { lagosToday } from '../lib/dates.ts';
import { closesFact } from '../lib/listing-text.ts';

export function initDetailPage(): void {
  const root = document.querySelector<HTMLElement>('[data-detail]');
  if (!root) return;
  const fact = closesFact(
    { deadline: root.dataset['deadline'] ?? '', status: root.dataset['status'] ?? '' },
    lagosToday(),
  );

  const closes = root.querySelector<HTMLElement>('[data-closes]');
  if (closes) {
    closes.textContent = fact.text;
    closes.toggleAttribute('data-urgent', fact.urgent);
  }

  if (fact.closed) {
    const banner = root.querySelector<HTMLElement>('[data-closed-banner]');
    if (banner) banner.hidden = false;
    root.querySelector<HTMLElement>('[data-apply]')?.remove();
  }
}
