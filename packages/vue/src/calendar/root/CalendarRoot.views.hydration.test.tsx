import { describe, expect, it } from 'vitest';
import { hydrate, renderOnServer } from '#test-utils';
import CalendarViewsHydration from './CalendarViewsHydration.test.vue';

const file = 'src/calendar/root/CalendarViewsHydration.test.vue';
const base = { today: '2026-11-14' };

// The text of a range depends on the data of `Intl`, and Node and each browser have other data. Vue
// does not patch a label, so a case with the years of a page gives the server HTML the range of the
// browser. The case then tests the page, and not the data of Node.
function withBrowserRange(serverHtml: string) {
  const serverRange = new DOMParser()
    .parseFromString(serverHtml, 'text/html')
    .querySelector('[role="group"]')!
    .getAttribute('aria-label')!;
  if (!/\d{4}\D+\d{4}/.test(serverRange)) {
    return serverHtml;
  }
  const browserRange = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
  }).formatRange(Date.parse('2016-01-01'), Date.parse('2027-01-01'));
  return serverHtml.replaceAll(serverRange, browserRange);
}

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
    const serverHtml = withBrowserRange(await renderOnServer(file, all));

    await hydrate(CalendarViewsHydration, { serverHtml, props: all });
  });

  it.each([
    { name: 'the months of a Hebrew server', server: 'en-US-u-ca-hebrew', view: 'month' as const, cells: 12 },
    { name: 'the years of a Persian server', server: 'en-US-u-ca-persian', view: 'year' as const, cells: 12 },
  ])('hydrates $name, then shows the calendar of the browser', async ({ server, view, cells }) => {
    const props = { ...base, view, locale: 'en-US' };
    const serverHtml = await renderOnServer(file, { ...props, locale: server });

    const { container } = await hydrate(CalendarViewsHydration, { serverHtml, props });

    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(cells);
    expect(container).toHaveTextContent('2026');
  });

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
      const serverHtml = withBrowserRange(await renderOnServer(file, all)).replace(
        `>${text}<`,
        '>other<',
      );
      expect(serverHtml).toContain('>other<');

      const { container } = await hydrate(CalendarViewsHydration, { serverHtml, props: all });

      expect(container).toHaveTextContent(text);
      expect(container).not.toHaveTextContent('other');
    },
  );
});
