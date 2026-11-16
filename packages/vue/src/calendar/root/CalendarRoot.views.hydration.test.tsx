import { describe, expect, it } from 'vitest';
import {
  hydrate,
  hydrateAfter,
  renderOnServer,
  screen,
  setAttributeInHtml,
  waitFor,
} from '#test-utils';
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

  // A `-u-ca-` keyword gives the server another calendar than the browser. The Hebrew year 5787
  // has 13 months.
  it.each([
    { name: 'the months of a Hebrew server', server: 'en-US-u-ca-hebrew', view: 'month' as const },
    { name: 'the years of a Persian server', server: 'en-US-u-ca-persian', view: 'year' as const },
  ])('hydrates $name, then shows the calendar of the browser', async ({ server, view }) => {
    const props = { ...base, view, locale: 'en-US' };
    const serverHtml = await renderOnServer(file, { ...props, locale: server });

    const { container } = await hydrate(CalendarViewsHydration, { serverHtml, props });

    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(12);
    expect(container).toHaveTextContent('2026');
  });

  // The cell of the server that has the focus is not in the grid of the browser, so the cell that
  // has the tab stop takes the focus.
  it.each([
    {
      name: 'the months of a Hebrew server',
      server: 'en-US-u-ca-hebrew',
      view: 'month' as const,
      cell: monthName('2026-11-01'),
    },
    {
      name: 'the years of a Persian server',
      server: 'en-US-u-ca-persian',
      view: 'year' as const,
      cell: '2026',
    },
  ])('keeps the focus in $name after the hydration', async ({ server, view, cell }) => {
    const props = { ...base, view, locale: 'en-US' };
    const serverHtml = await renderOnServer(file, { ...props, locale: server });

    await hydrateAfter(CalendarViewsHydration, {
      serverHtml,
      props,
      before: (container) => {
        container.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')!.focus();
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('gridcell', { name: cell })).toHaveFocus();
    });
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
});
