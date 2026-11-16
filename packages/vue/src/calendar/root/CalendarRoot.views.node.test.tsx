import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import CalendarViewsHydration from './CalendarViewsHydration.test.vue';

// 2026-11-14 is a Saturday. The page of years that holds 2026 has the years 2016 to 2027.
const props = { today: '2026-11-14' };

function format(
  options: Intl.DateTimeFormatOptions,
  iso: string,
  locale = 'en-US',
  calendar?: string,
) {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', calendar, ...options }).format(
    Date.parse(iso),
  );
}

const monthLabel = (iso: string, locale = 'en-US', calendar?: string) =>
  format({ month: 'long', year: 'numeric' }, iso, locale, calendar);

const fieldName = (field: 'month' | 'year') =>
  new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of(field);

// The start tag and the text of each cell button. The order of its attributes is not part of the
// test.
function readCells(html: string) {
  return [...html.matchAll(/<button([^>]* role="gridcell"[^>]*)>(?:<!--[[\]]-->)*([^<]*)/g)].map(
    ([, attributes, text]) => ({ attributes: attributes!, text: text! }),
  );
}

const attribute = (attributes: string, name: string) =>
  new RegExp(` ${name}="([^"]*)"`).exec(attributes)?.[1];

const names = (html: string) =>
  readCells(html).map(({ attributes, text }) => attribute(attributes, 'aria-label') ?? text);

const tabStops = (html: string) =>
  readCells(html)
    .filter(({ attributes }) => attribute(attributes, 'tabindex') === '0')
    .map(({ attributes, text }) => attribute(attributes, 'aria-label') ?? text);

const months = (year: number, locale = 'en-US', calendar?: string) =>
  Array.from({ length: 12 }, (_, index) =>
    monthLabel(`${year}-${String(index + 1).padStart(2, '0')}-01`, locale, calendar),
  );

describe('<Calendar.Root /> views on a server', () => {
  it('renders the grid of months with no DOM, and no days', async () => {
    expect(typeof document).toBe('undefined');

    const html = await renderToString(<CalendarViewsHydration {...props} view="month" />);

    expect(html).toMatch(/^<div[^>]* role="group"/);
    expect(html).toContain(' data-view="month"');
    expect(html).toContain(' role="grid"');
    expect(html).toContain(` aria-label="${fieldName('month')}"`);
    expect(html).not.toContain('<table');
    expect(names(html)).toEqual(months(2026));
    expect(readCells(html).map(({ text }) => text)).toEqual(
      Array.from({ length: 12 }, (_, index) =>
        format({ month: 'long' }, `2026-${String(index + 1).padStart(2, '0')}-01`),
      ),
    );
    expect(html.match(/role="row"/g)).toHaveLength(4);
  });

  it('renders the grid of years of the page that holds the month', async () => {
    const html = await renderToString(<CalendarViewsHydration {...props} view="year" />);

    expect(html).toContain(' data-view="year"');
    expect(html).toContain(` aria-label="${fieldName('year')}"`);
    expect(names(html)).toEqual(Array.from({ length: 12 }, (_, index) => String(2016 + index)));
  });

  it('names the root and the trigger by what each view shows', async () => {
    const month = await renderToString(<CalendarViewsHydration {...props} view="month" />);
    const year = await renderToString(<CalendarViewsHydration {...props} view="year" />);
    const day = await renderToString(<CalendarViewsHydration {...props} />);

    expect(month).toContain(' aria-label="2026"');
    expect(month).toMatch(/aria-live="polite"[^>]*>(?:<!--[[\]]-->)*2026</);
    const range = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
    }).formatRange(Date.parse('2016-01-01'), Date.parse('2027-01-01'));
    expect(year).toContain(` aria-label="${range}"`);
    expect(day).toContain(` aria-label="${monthLabel('2026-11-01')}"`);
    expect(day).toContain(' role="grid"');
  });

  it.each([
    { name: 'the month of today', extra: {}, expected: monthLabel('2026-11-01') },
    {
      name: 'the selected month',
      extra: { value: '2026-03-10' },
      expected: monthLabel('2026-03-01'),
    },
    {
      name: 'the month that a year and month selects',
      extra: { value: '2026-03' },
      expected: monthLabel('2026-03-01'),
    },
    {
      name: 'the first month, when the month of today is out of the limits',
      extra: { maxDate: '2026-09-01' },
      expected: monthLabel('2026-01-01'),
    },
  ])('writes one tab stop in the grid of months, on $name', async ({ extra, expected }) => {
    const html = await renderToString(
      <CalendarViewsHydration {...props} view="month" {...extra} />,
    );

    expect(tabStops(html)).toEqual([expected]);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(11);
  });

  it.each([
    { name: 'the year of today', extra: {}, expected: ['2026'] },
    { name: 'the selected year', extra: { value: '2018-03-10' }, expected: ['2018'] },
    { name: 'no year when the calendar is disabled', extra: { disabled: true }, expected: [] },
  ])('writes one tab stop in the grid of years, on $name', async ({ extra, expected }) => {
    const html = await renderToString(<CalendarViewsHydration {...props} view="year" {...extra} />);

    expect(tabStops(html)).toEqual(expected);
  });

  it('shows the grid of months for a year and month, and selects its month', async () => {
    const html = await renderToString(<CalendarViewsHydration {...props} value="2026-03" />);

    expect(html).toContain(' data-view="month"');
    expect(html).not.toContain('<table');
    const selected = readCells(html)
      .filter(({ attributes }) => attribute(attributes, 'aria-selected') === 'true')
      .map(({ attributes }) => attribute(attributes, 'aria-label'));
    expect(selected).toEqual([monthLabel('2026-03-01')]);
  });

  it('marks the month and the year of today, and the cells that are out of the limits', async () => {
    const month = await renderToString(
      <CalendarViewsHydration {...props} view="month" minDate="2026-03-10" />,
    );
    const current = readCells(month).filter(
      ({ attributes }) => attribute(attributes, 'aria-current') === 'date',
    );
    expect(current).toHaveLength(1);
    expect(attribute(current[0]!.attributes, 'aria-label')).toBe(monthLabel('2026-11-01'));
    expect(
      readCells(month).filter(({ attributes }) => attributes.includes(' data-disabled')),
    ).toHaveLength(2);

    const year = await renderToString(<CalendarViewsHydration {...props} view="year" />);
    expect(
      readCells(year)
        .filter(({ attributes }) => attribute(attributes, 'aria-current') === 'date')
        .map(({ text }) => text),
    ).toEqual(['2026']);
  });

  it('allows the text and the label that a browser can write another way', async () => {
    const html = await renderToString(<CalendarViewsHydration {...props} view="month" />);

    expect(
      readCells(html).every(
        ({ attributes }) => attribute(attributes, 'data-allow-mismatch') === 'attribute,text',
      ),
    ).toBe(true);
    expect(html).toMatch(
      /<button[^>]* data-allow-mismatch="text"[^>]*aria-live|<button[^>]* aria-live[^>]* data-allow-mismatch="text"/,
    );
  });

  it.each([
    {
      name: 'the Buddhist calendar of a locale',
      locale: 'th-TH',
      calendar: 'buddhist',
      value: '2026-11',
    },
    {
      name: 'the Persian calendar of a prop',
      locale: 'en-US',
      calendar: 'persian',
      value: undefined,
    },
  ])('shows the months of $name', async ({ locale, calendar, value }) => {
    const html = await renderToString(
      <CalendarViewsHydration
        {...props}
        view="month"
        locale={locale}
        value={value}
        calendar={calendar}
      />,
    );

    expect(readCells(html)).toHaveLength(12);
    const first = names(html)[0]!;
    expect(first).toBe(
      format(
        { month: 'long', year: 'numeric' },
        calendar === 'persian' ? '2026-03-21' : '2026-01-01',
        locale,
        calendar,
      ),
    );
  });
});
