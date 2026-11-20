import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { h, nextTick, reactive } from 'vue';
import type { CalendarRootChangeEventDetails } from '@vase-ui/vue/calendar';
import { Calendar } from '@vase-ui/vue/calendar';
import { dataAttributes } from '../../test/field';
import CalendarParts from '../../test/fixtures/CalendarParts.vue';
import { mount, mountError } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const day = (value: string) => Temporal.PlainDate.from(value);
// 2026-11-18 is a Wednesday. The weeks start on Monday.
const today = day('2026-11-18');

type Setup = Record<string, unknown> & { root?: Record<string, unknown> };

async function mountCalendar(setup: Setup = {}) {
  const { root, exposed } = mount(CalendarParts, {
    ...setup,
    root: setup.root ?? { today, locale: 'en-US' },
  });
  await nextTick();
  const query = <T extends Element = HTMLElement>(selector: string) =>
    root.querySelector<T & HTMLElement>(selector);
  return {
    root,
    exposed,
    group: query('[role=group]')!,
    query,
    cell: (date: string) => query(`[data-date="${date}"]`)!,
    button: (date: string) => query<HTMLButtonElement>(`[data-date="${date}"] button`),
    previous: () => root.querySelectorAll<HTMLButtonElement>('[role=group] > button')[0]!,
    next: () => root.querySelectorAll<HTMLButtonElement>('[role=group] > button')[1]!,
    caption: () => query('[aria-live=polite]:not(button)')!,
    selected: () =>
      [...root.querySelectorAll('[aria-selected=true]')].map((cell) =>
        cell.getAttribute('data-date'),
      ),
  };
}

/** Root props that write each event of the value and of the month in `log`. */
function logged(log: string[], props: Record<string, unknown> = {}) {
  return reactive<Record<string, unknown>>({
    today,
    locale: 'en-US',
    onValueChange: (value: unknown, details: CalendarRootChangeEventDetails) =>
      log.push(`valueChange ${String(value)} ${details.reason}`),
    'onUpdate:modelValue': (value: unknown) => log.push(`update ${String(value)}`),
    onMonthChange: (month: Temporal.PlainYearMonth, details: CalendarRootChangeEventDetails) =>
      log.push(`monthChange ${month} ${details.reason}`),
    'onUpdate:month': (month: Temporal.PlainYearMonth) => log.push(`update:month ${month}`),
    ...props,
  });
}

describe('the elements', () => {
  test('render a group named by the month, a table grid, a caption that names it, and buttons of type button', async () => {
    const { group, query, cell, button, previous } = await mountCalendar({ weekNumbers: true });
    expect(group.tagName).toBe('DIV');
    expect(group).toHaveAttribute('aria-label', 'November 2026');
    const grid = query('[role=grid]')!;
    expect(grid.tagName).toBe('TABLE');
    const caption = query(`#${grid.getAttribute('aria-labelledby')}`)!;
    expect(caption).toHaveTextContent('November 2026');
    expect(caption).toHaveAttribute('aria-live', 'polite');
    expect(grid).toHaveAttribute('aria-label', 'November 2026');
    expect(query('thead tr th[scope=col][abbr=Monday]')).toHaveTextContent('Mon');
    expect(cell('2026-11-18').tagName).toBe('TD');
    expect(cell('2026-11-18')).toHaveAttribute('role', 'gridcell');
    expect(button('2026-11-18')).toHaveAttribute('type', 'button');
    expect(button('2026-11-18')).toHaveAttribute('aria-label', 'Wednesday, November 18, 2026');
    expect(button('2026-11-18')).toHaveTextContent('18');
    expect(previous()).toHaveAttribute('type', 'button');
  });

  test('write the state attributes that no selector on the same element gives', async () => {
    const { group, query, cell, button, previous } = await mountCalendar({
      root: { today, locale: 'en-US', readonly: true, invalid: true, numberOfMonths: 2 },
    });
    expect(dataAttributes(group)).toEqual([
      'data-allow-mismatch',
      'data-empty',
      'data-invalid',
      'data-navigation-direction',
      'data-readonly',
      'data-view',
    ]);
    expect(group).toHaveAttribute('data-view', 'day');
    expect(group).toHaveAttribute('data-navigation-direction', 'none');
    const grid = query('[role=grid]')!;
    expect(grid).toHaveAttribute('aria-readonly', 'true');
    expect(dataAttributes(grid)).toEqual(['data-allow-mismatch', 'data-empty', 'data-invalid']);
    expect(dataAttributes(previous())).toEqual(['data-empty', 'data-invalid', 'data-readonly']);
    expect(dataAttributes(cell('2026-11-18'))).toEqual(['data-date', 'data-today']);
    expect(dataAttributes(button('2026-11-18')!)).toEqual(['data-allow-mismatch']);
  });

  test('render the tag of `as`', async () => {
    const { group, query, button } = await mountCalendar({
      root: { today, locale: 'en-US', as: 'section' },
      parts: { Caption: { as: 'h2' }, Month: { as: 'article' } },
      dayButton: { as: 'span' },
    });
    expect(group.tagName).toBe('SECTION');
    expect(query('h2')).toHaveTextContent('November 2026');
    expect(query('article [role=grid]')).not.toBeNull();
    const span = button('2026-11-18') ?? query('[data-date="2026-11-18"] span')!;
    expect(span.tagName).toBe('SPAN');
    expect(span).toHaveAttribute('role', 'button');
    expect(span).not.toHaveAttribute('type');
  });

  test('the element slot replaces the element, and the template ref has element and focus', async () => {
    const { root, exposed } = mount({
      setup: () => () =>
        h(Calendar.Root, { today, locale: 'en-US', ref: 'calendar' } as never, {
          element: ({ props, elementRef }: { props: object; elementRef: () => void }) =>
            h('section', { ...props, ref: elementRef, 'data-own': '' }, 'content'),
        }),
    });
    await nextTick();
    const section = root.querySelector('section')!;
    expect(section).toHaveAttribute('role', 'group');
    expect(section).toHaveAttribute('data-own');
    expect(exposed).toBeDefined();
  });

  test('throw outside their root, their month and their day', () => {
    expect(String(mountError(Calendar.Caption))).toMatch(/must be inside <Calendar.Root>/);
    expect(
      String(mountError({ render: () => h(Calendar.Root, { today }, () => h(Calendar.Grid)) })),
    ).toMatch(/must be inside <Calendar.Month>/);
  });
});

describe('the value', () => {
  test('a press selects a day: valueChange, then update; a press on the selected day emits nothing', async () => {
    const log: string[] = [];
    const { button, selected } = await mountCalendar({ root: logged(log) });
    button('2026-11-10')!.click();
    await nextTick();
    expect(log).toEqual(['valueChange 2026-11-10 day-press', 'update 2026-11-10']);
    expect(selected()).toEqual(['2026-11-10']);
    button('2026-11-10')!.click();
    expect(log).toHaveLength(2);
  });

  test('a cancel keeps the value, and a parent that keeps its value keeps the selection', async () => {
    const log: string[] = [];
    const props = logged(log, { modelValue: day('2026-11-03') });
    props.onValueChange = (_: unknown, details: CalendarRootChangeEventDetails) => details.cancel();
    const { button, selected } = await mountCalendar({ root: props });
    button('2026-11-10')!.click();
    await nextTick();
    expect(log).toEqual([]);
    props.onValueChange = undefined;
    await nextTick();
    button('2026-11-11')!.click();
    await nextTick();
    expect(log).toEqual(['update 2026-11-11']);
    expect(selected()).toEqual(['2026-11-03']);
  });

  test('with multiple, a press adds a day up to maxDays and removes one down to minDays', async () => {
    const log: string[] = [];
    const { button, selected } = await mountCalendar({
      root: logged(log, { multiple: true, minDays: 1, maxDays: 2 }),
    });
    for (const date of ['2026-11-10', '2026-11-12', '2026-11-14']) button(date)!.click();
    await nextTick();
    expect(selected()).toEqual(['2026-11-10', '2026-11-12']);
    button('2026-11-10')!.click();
    button('2026-11-12')!.click();
    await nextTick();
    expect(selected()).toEqual(['2026-11-12']);
    expect(log.filter((entry) => entry.startsWith('update'))).toEqual([
      'update 2026-11-10',
      'update 2026-11-10,2026-11-12',
      'update 2026-11-12',
    ]);
  });

  test.each([
    {
      name: 'a zoned value keeps its time and zone',
      value: Temporal.ZonedDateTime.from('2026-11-03T09:30[Asia/Tokyo]'),
      expected: '2026-11-10T09:30:00+09:00[Asia/Tokyo]',
    },
    {
      name: 'a date and time keeps its time',
      value: Temporal.PlainDateTime.from('2026-11-03T08:15'),
      expected: '2026-11-10T08:15:00',
    },
    {
      name: 'a Persian date keeps its calendar',
      value: Temporal.PlainDate.from('2026-11-03').withCalendar('persian'),
      expected: '2026-11-10[u-ca=persian]',
    },
  ])('a new value has the kind of the first value: $name', async ({ value, expected }) => {
    const log: string[] = [];
    const { button } = await mountCalendar({ root: logged(log, { defaultValue: value }) });
    button('2026-11-10')!.click();
    expect(log[0]).toBe(`valueChange ${expected} day-press`);
  });

  test('a read-only calendar selects nothing, and its days take the focus', async () => {
    const log: string[] = [];
    const { button } = await mountCalendar({ root: logged(log, { readonly: true }) });
    button('2026-11-10')!.click();
    button('2026-11-10')!.focus();
    expect(log).toEqual([]);
    expect(document.activeElement).toBe(button('2026-11-10'));
  });
});

describe('the days', () => {
  test('a disabled day has disabled, an unavailable day has aria-disabled and takes no press, and a hidden day has no button', async () => {
    const log: string[] = [];
    const { cell, button } = await mountCalendar({
      root: logged(log, {
        min: day('2026-11-05'),
        unavailableDates: day('2026-11-10'),
        hiddenDates: day('2026-11-11'),
      }),
    });
    expect(button('2026-11-04')).toBeDisabled();
    expect(cell('2026-11-04')).toHaveAttribute('aria-disabled', 'true');
    expect(cell('2026-11-04')).toHaveAttribute('data-disabled');
    expect(button('2026-11-10')).not.toBeDisabled();
    expect(button('2026-11-10')).toHaveAttribute('aria-disabled', 'true');
    expect(cell('2026-11-10')).toHaveAttribute('data-unavailable');
    expect(button('2026-11-10')).toHaveAttribute('data-unavailable');
    button('2026-11-10')!.click();
    expect(log).toEqual([]);
    expect(button('2026-11-11')).toBeNull();
    expect(cell('2026-11-11')).toHaveAttribute('data-hidden');
    expect(cell('2026-11-11')).not.toHaveAttribute('aria-selected');
  });

  test('today has aria-current="date", and an outside day has data-outside-month', async () => {
    const { cell, button } = await mountCalendar({
      root: { today, locale: 'en-US', showOutsideDays: true },
    });
    expect(button('2026-11-18')).toHaveAttribute('aria-current', 'date');
    expect(cell('2026-11-18')).toHaveAttribute('data-today');
    expect(button('2026-11-17')).not.toHaveAttribute('aria-current');
    expect(cell('2026-12-01')).toHaveAttribute('data-outside-month');
    expect(button('2026-12-01')).toHaveAttribute('data-outside-month');
    expect(button('2026-10-26')).toHaveAttribute('data-outside-month');
  });

  test('a modifier gives its kebab case attribute and its state to the day and its button', async () => {
    const { cell, button } = await mountCalendar({
      root: { today, locale: 'en-US', modifiers: { publicHoliday: day('2026-11-11') } },
    });
    expect(cell('2026-11-11')).toHaveAttribute('data-public-holiday');
    expect(button('2026-11-11')).toHaveAttribute('data-public-holiday');
    expect(cell('2026-11-12')).not.toHaveAttribute('data-public-holiday');
  });
});

describe('the navigation buttons', () => {
  test('are named by Intl in the locale, and an aria-label of the developer wins', async () => {
    const { previous, next } = await mountCalendar({
      root: { today, locale: 'fr', numberOfMonths: 2, pagedNavigation: true },
      parts: { NextButton: { 'aria-label': 'Later' } },
    });
    const name = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' }).format(-2, 'month');
    expect(previous()).toHaveAttribute('aria-label', name);
    expect(next()).toHaveAttribute('aria-label', 'Later');
  });

  test('a press moves the page: monthChange, then update:month; a cancel keeps the page', async () => {
    const log: string[] = [];
    const props = logged(log);
    const { next, caption } = await mountCalendar({ root: props });
    next().click();
    await nextTick();
    expect(log).toEqual(['monthChange 2026-12 month-change', 'update:month 2026-12']);
    expect(caption()).toHaveTextContent('December 2026');
    props.onMonthChange = (_: unknown, details: CalendarRootChangeEventDetails) => details.cancel();
    await nextTick();
    next().click();
    await nextTick();
    expect(caption()).toHaveTextContent('December 2026');
  });

  test('at a limit a button has aria-disabled and keeps its focus; a disabled calendar gives disabled', async () => {
    const props = reactive<Record<string, unknown>>({
      today,
      locale: 'en-US',
      max: day('2026-12-20'),
    });
    const { next } = await mountCalendar({ root: props });
    next().focus();
    next().click();
    await nextTick();
    expect(next()).toHaveAttribute('aria-disabled', 'true');
    expect(next()).not.toBeDisabled();
    expect(document.activeElement).toBe(next());
    props.disabled = true;
    await nextTick();
    expect(next()).toBeDisabled();
  });

  test('a hold with the mouse repeats the move until the limit, and its click moves no more', async () => {
    const log: string[] = [];
    const { next } = await mountCalendar({ root: logged(log, { max: day('2027-02-10') }) });
    const rect = next().getBoundingClientRect();
    const coords = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    await userEvent.pointer({ coords, keys: '[MouseLeft>]' });
    await waitFor(() => expect(next()).toHaveAttribute('aria-disabled', 'true'));
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(log.filter((entry) => entry.startsWith('update:month'))).toEqual([
      'update:month 2026-12',
      'update:month 2027-01',
      'update:month 2027-02',
    ]);
  });
});

describe('the selects', () => {
  test('show the month and the year of the page, and a change moves the page', async () => {
    const log: string[] = [];
    const { query } = await mountCalendar({
      selects: true,
      root: logged(log, { min: day('2026-11-05'), max: day('2027-03-01') }),
    });
    const [month, year] = [...query('[role=group]')!.querySelectorAll('select')];
    expect(month).toHaveAttribute('aria-label', 'month');
    expect(month!.value).toBe('M11');
    expect(month!.querySelector('option[value=M10]')).toBeDisabled();
    expect(year!.value).toBe('2026');
    expect([...year!.options].map((option) => option.value)).toEqual(['2026', '2027']);
    await userEvent.selectOptions(year!, '2027');
    expect(log).toEqual(['monthChange 2027-03 month-change', 'update:month 2027-03']);
  });

  test('show the month of the page again after a cancel', async () => {
    const props = logged([], {
      onMonthChange: (_: unknown, details: CalendarRootChangeEventDetails) => details.cancel(),
    });
    const { query } = await mountCalendar({ selects: true, root: props });
    const month = query<HTMLSelectElement>('select')!;
    await userEvent.selectOptions(month, 'M03');
    await nextTick();
    expect(month.value).toBe('M11');
  });
});

describe('the caption and the week numbers', () => {
  test('a caption after the grid names it after the mount', async () => {
    const { query } = await mountCalendar({ captionAfter: true });
    const grid = query('[role=grid]')!;
    expect(grid).toHaveAttribute('aria-labelledby', query('[aria-live=polite]')!.id);
  });

  test('an aria-label of the developer on the grid replaces the caption', async () => {
    const { query } = await mountCalendar({ parts: { Grid: { 'aria-label': 'Days' } } });
    const grid = query('[role=grid]')!;
    expect(grid).toHaveAttribute('aria-label', 'Days');
    expect(grid).not.toHaveAttribute('aria-labelledby');
  });

  test('the weeks start on Monday and have their ISO number; the head is named by Intl', async () => {
    const { query } = await mountCalendar({ weekNumbers: true });
    expect(query('thead th[aria-label]')).toHaveAttribute('aria-label', 'week');
    const firstRow = query('tbody tr')!;
    const number = firstRow.querySelector('th[scope=row]')!;
    expect(number).toHaveTextContent('44');
    expect(number).toHaveAttribute('data-week-number', '44');
    expect(firstRow.querySelector('td')).toHaveAttribute('data-date', '2026-10-26');
  });

  test('firstDayOfWeek and firstWeekContainsDate give the US weeks', async () => {
    const { query } = await mountCalendar({
      weekNumbers: true,
      root: { today, locale: 'en-US', firstDayOfWeek: 7 },
    });
    const firstRow = query('tbody tr')!;
    expect(firstRow.querySelector('td')).toHaveAttribute('data-date', '2026-11-01');
    expect(firstRow.querySelector('th')).toHaveTextContent('45');
  });
});

describe('a development build', () => {
  test('throws for a modifier with the name of a day attribute', () => {
    expect(
      String(
        mountError(CalendarParts, {
          root: { today, modifiers: { outsideMonth: day('2026-11-11') } },
        }),
      ),
    ).toMatch(/The `modifiers` prop of <Calendar.Root> has the key `outsideMonth`/);
  });
});
