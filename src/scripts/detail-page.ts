// Detail pages are built once a day. This re-checks the listing against today's date in
// Lagos, so between builds "N days left" stays right and a listing whose deadline has
// passed shows "This opening has closed" with no Apply button.
import { lagosToday } from '../lib/dates.ts';
import { cardState } from '../lib/listing-text.ts';

export function initDetailPage(): void {
  const root = document.querySelector<HTMLElement>('[data-detail]');
  if (!root) return;
  const listing = {
    deadline: root.dataset['deadline'] ?? '',
    status: root.dataset['status'] ?? '',
    firstSeen: root.dataset['firstSeen'] ?? '',
  };
  const state = cardState(listing, lagosToday());

  const chip = root.querySelector<HTMLElement>('[data-deadline-chip]');
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

  if (state.deadline.kind === 'closed') {
    const banner = root.querySelector<HTMLElement>('[data-closed-banner]');
    if (banner) banner.hidden = false;
    root.querySelector<HTMLElement>('[data-apply]')?.remove();
    root.querySelector<HTMLElement>('[data-detail-badges]')?.remove();
  }
}
