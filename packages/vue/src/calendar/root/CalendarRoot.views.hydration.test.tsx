import { describe, expect, it } from 'vitest';
import { hydrate, mockBrowserToday, renderOnServer, setAttributeInHtml } from '#test-utils';
import CalendarViewsHydration from './CalendarViewsHydration.test.vue';

const file = 'src/calendar/root/CalendarViewsHydration.test.vue';
const base = { today: '2026-11-14' };

const monthName = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    Date.parse(iso),
  );
const fieldName = (field: 'month' | 'year') =>
  new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of(field)!;

describe('<Calendar.Root /> views hydration', () => {
  it.each([
    { name: 'the grid of months', props: { view: 'month' as const } },
    {
      name: 'the grid of years, with limits',
      props: { view: 'year' as const, minDate: '2018-01-01', maxDate: '2025-12-31' },
    },
    { name: 'a year and month that is selected', props: { value: '2026-03' } },
    {
      name: 'the grid of months of a Buddhist calendar',
      props: { view: 'month' as const, calendar: 'buddhist' },
    },
    { name: 'a disabled grid of years', props: { view: 'year' as const, disabled: true } },
    { name: 'four columns of three months', props: { view: 'month' as const, columns: 4 } },
  ])('hydrates $name with no warning and no difference', async ({ props }) => {
    const all = { ...base, ...props };
    const serverHtml = await renderOnServer(file, all);

    await hydrate(CalendarViewsHydration, { serverHtml, props: all });
  });

  it.each([
    {
      name: 'the year trigger',
      props: {},
      selector: '[data-testid="year-trigger"]',
      label: `${monthName('2026-11-01')}, choose the year`,
    },
    {
      name: 'the month trigger',
      props: {},
      selector: '[data-testid="month-trigger"]',
      label: `${monthName('2026-11-01')}, choose the month`,
    },
    {
      name: 'the grid of months',
      props: { view: 'month' as const },
      selector: '[role="grid"]',
      label: fieldName('month'),
    },
    {
      name: 'a month',
      props: { view: 'month' as const },
      selector: '[role="gridcell"]',
      label: monthName('2026-01-01'),
    },
    {
      name: 'the grid of years',
      props: { view: 'year' as const },
      selector: '[role="grid"]',
      label: fieldName('year'),
    },
  ])(
    'gives $name the aria-label of the browser when the server wrote another text',
    async ({ props, selector, label }) => {
      const all = { ...base, ...props };
      const serverHtml = setAttributeInHtml(
        await renderOnServer(file, all),
        selector,
        'aria-label',
        'other',
      );

      const { container } = await hydrate(CalendarViewsHydration, { serverHtml, props: all });

      expect(container.querySelector(selector)).toHaveAttribute('aria-label', label);
    },
  );

  it.each([
    { name: 'a day', props: {}, text: '14' },
    { name: 'a weekday', props: {}, text: 'Sat' },
    { name: 'a month', props: { view: 'month' as const }, text: 'March' },
    { name: 'a year', props: { view: 'year' as const }, text: '2019' },
    { name: 'the name of the page', props: { view: 'month' as const }, text: '2026' },
  ])(
    'writes the text of $name again with no warning when the server wrote another text',
    async ({ props, text }) => {
      const all = { ...base, ...props };
      const serverHtml = (await renderOnServer(file, all)).replace(`>${text}<`, '>other<');
      expect(serverHtml).toContain('>other<');

      const { container } = await hydrate(CalendarViewsHydration, { serverHtml, props: all });

      expect(container).toHaveTextContent(text);
      expect(container).not.toHaveTextContent('other');
    },
  );

  it.each([
    {
      name: 'month',
      view: 'month' as const,
      // A month cell has the month and its year as its name.
      expected: (day: Temporal.PlainDate) =>
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          month: 'long',
          year: 'numeric',
        }).format(Date.parse(day.toString())),
      read: (cell: HTMLElement) => cell.getAttribute('aria-label'),
    },
    {
      name: 'year',
      view: 'year' as const,
      expected: (day: Temporal.PlainDate) => String(day.year),
      read: (cell: HTMLElement) => cell.textContent,
    },
  ])("marks the current $name of the browser's today", async ({ view, expected, read }) => {
    const props = { locale: 'en-US', view };
    const serverHtml = await renderOnServer(file, props);
    const browserDay = mockBrowserToday('year');

    const { container } = await hydrate(CalendarViewsHydration, { serverHtml, props });

    const current = [...container.querySelectorAll<HTMLElement>('[data-current]')];
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('aria-current', 'date');
    expect(read(current[0]!)).toBe(expected(browserDay));
  });
});
