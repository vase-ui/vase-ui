import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { takeReportedMessages } from '../../../test/reportedMessages';
import * as Calendar from '../index.parts';
import CalendarNavigationHydration from './CalendarNavigationHydration.test.vue';

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const props = { today: '2026-11-14' };

function format(options: Intl.DateTimeFormatOptions, iso: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

const monthName = (iso: string) => format({ month: 'long', year: 'numeric' }, iso);

function countOf(html: string, pattern: RegExp) {
  return html.match(pattern)?.length ?? 0;
}

describe('<Calendar.Root /> navigation on a server', () => {
  it('renders the caption, the buttons and the footer with no DOM', async () => {
    expect(typeof document).toBe('undefined');

    const html = await renderToString(
      <CalendarNavigationHydration {...props} footer="No day is selected." />,
    );

    expect(html).toContain(' aria-label="Previous month"');
    expect(html).toContain(' aria-label="Next month"');
    expect(html).toContain(` aria-live="polite"`);
    expect(html).toMatch(
      new RegExp(` aria-live="polite"[^>]*>(?:<!--[[\\]]-->)*${monthName('2026-11-14')}<`),
    );
    expect(html).toMatch(
      /<div[^>]* role="status"[^>]*>(?:<!--[[\]]-->)*No day is selected\.(?:<!--[[\]]-->)*<\/div>/,
    );
    expect(html).toContain(' data-navigation-direction="none"');
  });

  it('allows the text that a browser can write another way, in the caption and in the options', async () => {
    const html = await renderToString(<CalendarNavigationHydration {...props} selects />);

    const caption = /<div[^>]* aria-live="polite"[^>]*>/.exec(html)![0];
    expect(caption).toContain(' data-allow-mismatch="text"');
    const options = html.match(/<option[^>]*>/g)!;
    expect(options.length).toBeGreaterThan(12);
    expect(options.every((tag) => tag.includes(' data-allow-mismatch="text"'))).toBe(true);
  });

  it('names the grid by the id of its caption, as the client does', async () => {
    const html = await renderToString(<CalendarNavigationHydration {...props} />);

    const id = /<div[^>]* id="([^"]+)"[^>]* aria-live="polite"/.exec(html)![1];
    expect(html).toContain(` aria-labelledby="${id}"`);
  });

  it.each([
    { name: 'the first month', props: { minDate: '2026-11-01' }, previous: true, next: false },
    { name: 'the last month', props: { maxDate: '2026-11-30' }, previous: false, next: true },
    { name: 'a month with room on both sides', props: {}, previous: false, next: false },
  ])(
    'marks the button at the limit as unavailable: $name',
    async ({ props: extra, previous, next }) => {
      const html = await renderToString(<CalendarNavigationHydration {...props} {...extra} />);

      const tagOf = (label: string) =>
        new RegExp(`<button[^>]* aria-label="${label}"[^>]*>`).exec(html)![0];
      expect(tagOf('Previous month').includes(' aria-disabled="true"')).toBe(previous);
      expect(tagOf('Next month').includes(' aria-disabled="true"')).toBe(next);
    },
  );

  it('numbers the weeks, and writes the digits as text that a browser can write another way', async () => {
    const html = await renderToString(<CalendarNavigationHydration {...props} weekNumbers />);

    const headers = [
      ...html.matchAll(
        /<th [^>]*scope="row"[^>]*>(?:<!--[[\]]-->)*([^<]*)(?:<!--[[\]]-->)*<\/th>/g,
      ),
    ];
    expect(headers.map((header) => header[1])).toEqual(['45', '46', '47', '48', '49']);
    expect(headers.every((header) => header[0].includes(' data-allow-mismatch="text"'))).toBe(true);
    expect(headers[0]![0]).toContain(' aria-label="Week 45"');
    expect(html).toMatch(/<th [^>]*scope="col"[^>]* aria-label="Week number"/);
  });

  it('selects the option of the month and of the year of the page, in each select', async () => {
    const html = await renderToString(
      <CalendarNavigationHydration {...props} selects minDate="2025-01-01" maxDate="2027-12-31" />,
    );

    expect(html).toMatch(/<option value="M11"[^>]* selected/);
    expect(countOf(html, /<option value="M\d\d"/g)).toBe(12);
    expect(html).toMatch(/<option value="2026"[^>]* selected/);
    expect(countOf(html, /<option value="20\d\d"/g)).toBe(3);
    expect(html).toContain(' aria-label="month"');
    expect(html).toContain(' aria-label="year"');
  });

  it.each([
    { name: 'two months', extra: { numberOfMonths: 2 }, grids: 2, rows: 10 },
    { name: 'fixed weeks', extra: { fixedWeeks: true }, grids: 1, rows: 6 },
    { name: 'the broadcast calendar', extra: { broadcastCalendar: true }, grids: 1, rows: 5 },
    { name: 'two weeks', extra: { duration: 'weeks:2' }, grids: 1, rows: 2 },
    { name: 'five days', extra: { duration: 'days:5' }, grids: 1, rows: 1 },
  ])('renders the grids and the weeks of $name', async ({ extra, grids, rows }) => {
    const html = await renderToString(<CalendarNavigationHydration {...props} {...extra} />);

    const bodies = html.match(/<tbody[^>]*>.*?<\/tbody>/gs) ?? [];
    expect(countOf(html, /<table[ >]/g)).toBe(grids);
    expect(bodies).toHaveLength(grids);
    expect(countOf(bodies.join(''), /<tr[ >]/g)).toBe(rows);
  });

  it.each([
    { name: 'a page of one month', extra: {} },
    { name: 'two months, with outside days', extra: { numberOfMonths: 2, showOutsideDays: true } },
    { name: 'the broadcast calendar', extra: { broadcastCalendar: true } },
    { name: 'two weeks', extra: { duration: 'weeks:2' } },
  ])('writes one tab stop for $name', async ({ extra }) => {
    const html = await renderToString(<CalendarNavigationHydration {...props} {...extra} />);

    expect(countOf(html, /<td[^>]*>(?:<!--[[\]]-->)*<button[^>]* tabindex="0"/g)).toBe(1);
    expect(html).toMatch(
      /<td[^>]* data-date="2026-11-14"[^>]*>(?:<!--[[\]]-->)*<button[^>]* tabindex="0"/,
    );
  });

  it('ends the pages with the month of maxDate when fewer months are between the limits', async () => {
    const html = await renderToString(
      <CalendarNavigationHydration
        {...props}
        numberOfMonths={3}
        minDate="2026-11-05"
        maxDate="2026-12-20"
      />,
    );

    const captions = [...html.matchAll(/ aria-live="polite"[^>]*>(?:<!--[[\]]-->)*([^<]+)</g)].map(
      (caption) => caption[1],
    );
    expect(captions).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'].map(monthName));
  });

  it('writes a day that two grids hold once, with a button', async () => {
    const html = await renderToString(
      <CalendarNavigationHydration {...props} numberOfMonths={2} showOutsideDays />,
    );

    expect(countOf(html, /<td[^>]* data-date="2026-12-02"/g)).toBe(2);
    expect(countOf(html, /<td[^>]* data-date="2026-12-02"[^>]*>(?:<!--[[\]]-->)*<button/g)).toBe(1);
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws when the broadcast calendar has another calendar than the Gregorian one', async () => {
    await expect(
      renderToString(
        <Calendar.Root
          today={Temporal.PlainDate.from('2026-11-14')}
          broadcastCalendar
          calendar="persian"
        />,
      ),
    ).rejects.toThrow(
      'Vase UI: <Calendar.Root> has `broadcastCalendar` and shows the calendar `persian`. The broadcast calendar is made of Gregorian months, so no other calendar can show it. Remove `broadcastCalendar`, or set `calendar="gregory"`.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of watcher callback'),
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
