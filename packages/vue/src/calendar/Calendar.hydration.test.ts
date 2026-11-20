import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import CalendarOnServer from '../../test/fixtures/CalendarOnServer.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const clockToday = () => Temporal.Now.plainDateISO();

describe('server render and hydration', () => {
  test('the server HTML has the name, the caption, the selects, the grid names, the selection and one tab stop; the hydration keeps them', async () => {
    const props = { today: '2026-11-18', value: '2026-11-10', selects: true, weekNumbers: true };
    const root = await renderOnServer('CalendarOnServer', props);
    const group = root.querySelector('[role=group]')!;
    const grid = root.querySelector('[role=grid]')!;
    expect(group).toHaveAttribute('aria-label', 'November 2026');
    expect(grid).toHaveAttribute('aria-labelledby', root.querySelector('[aria-live=polite]')!.id);
    expect(root.querySelector('option[value=M11]')).toHaveAttribute('selected');
    expect(root.querySelector('[aria-selected=true]')).toHaveAttribute('data-date', '2026-11-10');
    expect(root.querySelectorAll('[role=grid] [tabindex="0"]')).toHaveLength(1);
    expect(root.querySelector('[aria-current=date]')).toHaveAttribute(
      'aria-label',
      'Wednesday, November 18, 2026',
    );
    const button = root.querySelector('[data-date="2026-11-10"] button');
    hydrate(CalendarOnServer, props, root);
    await nextTick();
    expect(root.querySelector('[data-date="2026-11-10"] button')).toBe(button);
    expect(button).toHaveAttribute('tabindex', '0');
  });

  test('with no today, no render reads the clock: the server HTML marks no day, and today comes after the mount', async () => {
    const props = { month: '2026-11' };
    const root = await renderOnServer('CalendarOnServer', props);
    expect(root.querySelector('[aria-current]')).toBeNull();
    hydrate(CalendarOnServer, props, root);
    await nextTick();
    const now = clockToday();
    const current = root.querySelector('[aria-current=date]');
    expect(current?.closest('[data-date]')?.getAttribute('data-date') ?? null).toBe(
      now.toPlainYearMonth().equals(Temporal.PlainYearMonth.from('2026-11'))
        ? now.toString()
        : null,
    );
  });

  test('with nothing that gives a page, the server HTML has no month and the buttons are disabled; the page of today comes after the mount', async () => {
    const root = await renderOnServer('CalendarOnServer', { selects: true });
    const group = root.querySelector('[role=group]')!;
    expect(root.querySelector('[role=grid]')).toBeNull();
    expect(group).not.toHaveAttribute('aria-label');
    expect(group.querySelector(':scope > button')).toHaveAttribute('aria-disabled', 'true');
    expect(group.querySelector('select')).toBeDisabled();
    hydrate(CalendarOnServer, { selects: true }, root);
    await waitFor(() => expect(root.querySelector('[role=grid]')).not.toBeNull());
    const now = clockToday();
    expect(root.querySelector('[aria-current=date]')!.closest('[data-date]')).toHaveAttribute(
      'data-date',
      now.toString(),
    );
    expect(group).toHaveAttribute('data-navigation-direction', 'none');
  });

  // 2026-11-01 is a Sunday.
  test.each([
    { locale: 'en-US', first: '2026-11-01' },
    { locale: 'de-DE', first: '2026-10-26' },
    { locale: 'ar-EG', first: '2026-10-31' },
    { locale: 'en', first: '2026-11-01' },
  ])('the weeks of $locale start on the same day on both sides', async ({ locale, first }) => {
    const props = { today: '2026-11-18', weekNumbers: true, root: { locale } };
    const root = await renderOnServer('CalendarOnServer', props);
    const cell = root.querySelector('tbody td');
    expect(cell).toHaveAttribute('data-date', first);
    hydrate(CalendarOnServer, props, root);
    await nextTick();
    expect(root.querySelector('tbody td')).toBe(cell);
    expect(cell).toHaveAttribute('data-date', first);
  });

  test('a Persian calendar renders the same on both sides', async () => {
    const props = { today: '2026-11-18', root: { calendar: 'persian', locale: 'fa-IR' } };
    const root = await renderOnServer('CalendarOnServer', props);
    expect(root.querySelector('[role=group]')).toHaveAttribute(
      'aria-label',
      new Intl.DateTimeFormat('fa-IR', {
        calendar: 'persian',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(Date.UTC(2026, 10, 18)),
    );
    hydrate(CalendarOnServer, props, root);
    await nextTick();
  });

  test('the grid of years renders the same on both sides', async () => {
    const props = { today: '2026-11-18', views: true, root: { defaultView: 'year' } };
    const root = await renderOnServer('CalendarOnServer', props);
    expect(root.querySelector('[data-year="2026"]')).toHaveAttribute('aria-current', 'date');
    expect(root.querySelectorAll('[data-year][tabindex="0"]')).toHaveLength(1);
    hydrate(CalendarOnServer, props, root);
    await nextTick();
  });

  test('a server with other Intl data than the browser gives other texts, and the hydration writes the texts of the browser with no message', async () => {
    const props = { today: '2026-11-18', views: true };
    const root = await renderOnServer('CalendarOnServer', props);
    const caption = root.querySelector('[role=group] div[aria-live=polite]')!;
    const trigger = root.querySelector('[role=group] button[aria-live=polite]')!;
    const weekday = root.querySelector('th[abbr]')!;
    caption.textContent = 'server month';
    trigger.textContent = 'server range';
    weekday.textContent = 'server day';
    hydrate(CalendarOnServer, props, root);
    await nextTick();
    expect(caption).toHaveTextContent('November 2026');
    expect(trigger).toHaveTextContent('November 2026');
    expect(weekday).toHaveTextContent('Sun');
  });
});
