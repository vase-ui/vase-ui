import { describe, expect, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import CalendarParts from '../../test/fixtures/CalendarParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const day = (value: string) => Temporal.PlainDate.from(value);
const month = (value: string) => Temporal.PlainYearMonth.from(value);
// 2026-11-18 is a Wednesday. The weeks start on Monday.
const today = day('2026-11-18');

async function mountCalendar(setup: Record<string, unknown> = {}) {
  const log: string[] = [];
  const root = reactive<Record<string, unknown>>({
    today,
    locale: 'en-US',
    onMonthChange: (value: Temporal.PlainYearMonth) => log.push(`monthChange ${value.toString()}`),
    'onUpdate:month': (value: Temporal.PlainYearMonth) =>
      log.push(`update:month ${value.toString()}`),
    ...(setup.root as object),
  });
  const { root: container } = mount(CalendarParts, { ...setup, root });
  await nextTick();
  const group = container.querySelector<HTMLElement>('[role=group]')!;
  return {
    root,
    log,
    group,
    container,
    captions: () =>
      [...container.querySelectorAll('[role=group] [aria-live=polite]')].map(
        (caption) => caption.textContent,
      ),
    days: () =>
      [...container.querySelectorAll('[data-date]')]
        .filter((cell) => cell.querySelector('button'))
        .map((cell) => cell.getAttribute('data-date')),
    move: async (direction: 'previous' | 'next') => {
      group.querySelectorAll<HTMLElement>(':scope > button')[direction === 'next' ? 1 : 0]!.click();
      await nextTick();
    },
  };
}

describe('the first page', () => {
  test.each([
    { name: 'month', root: { month: month('2027-03') }, expected: 'March 2027' },
    { name: 'defaultMonth', root: { defaultMonth: month('2027-04') }, expected: 'April 2027' },
    {
      name: 'the focused day',
      root: { defaultFocusedDate: day('2027-05-02') },
      expected: 'May 2027',
    },
    { name: 'the value', root: { defaultValue: day('2027-06-02') }, expected: 'June 2027' },
    { name: 'today', root: {}, expected: 'November 2026' },
  ])('comes from $name', async ({ root, expected }) => {
    const { captions } = await mountCalendar({ root });
    expect(captions()).toEqual([expected]);
  });

  test('keeps to max when the root picks it, and shows a month of the developer as it is', async () => {
    expect((await mountCalendar({ root: { max: day('2026-09-10') } })).captions()).toEqual([
      'September 2026',
    ]);
    const given = await mountCalendar({
      root: { max: day('2026-09-10'), defaultMonth: month('2026-11') },
    });
    expect(given.captions()).toEqual(['November 2026']);
  });
});

describe('the form of a page', () => {
  test('numberOfMonths shows months in a row, and pagedNavigation moves by all of them', async () => {
    const { captions, move, group } = await mountCalendar({
      root: { numberOfMonths: 2, pagedNavigation: true },
    });
    expect(captions()).toEqual(['November 2026', 'December 2026']);
    expect(group).toHaveAttribute('aria-label', 'November – December 2026');
    await move('next');
    expect(captions()).toEqual(['January 2027', 'February 2027']);
  });

  test('a day that two months show has one button, in the month that owns it', async () => {
    const { days } = await mountCalendar({ root: { numberOfMonths: 2, showOutsideDays: true } });
    const shown = days();
    expect(shown.filter((date) => date === '2026-12-01')).toHaveLength(1);
    expect(new Set(shown).size).toBe(shown.length);
  });

  test('fixedWeeks gives each month six weeks', async () => {
    const { container } = await mountCalendar({ root: { fixedWeeks: true } });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(6);
  });

  test('broadcastCalendar shows the weeks of the broadcast month and its outside days', async () => {
    const { container, days } = await mountCalendar({ root: { broadcastCalendar: true } });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(days()[0]).toBe('2026-10-26');
    expect(days().at(-1)).toBe('2026-11-29');
  });

  test('visibleDuration shows weeks, and the buttons move by them', async () => {
    const { captions, move, days } = await mountCalendar({
      root: { visibleDuration: { weeks: 2 } },
    });
    expect(days()[0]).toBe('2026-11-16');
    expect(days()).toHaveLength(14);
    expect(captions()).toEqual(['November 16 – 29, 2026']);
    await move('next');
    expect(days()[0]).toBe('2026-11-30');
  });

  test('a parent that keeps month keeps the page', async () => {
    const { captions, move, log } = await mountCalendar({ root: { month: month('2026-11') } });
    await move('next');
    expect(log).toEqual(['monthChange 2026-12', 'update:month 2026-12']);
    expect(captions()).toEqual(['November 2026']);
  });
});

describe('the direction of the navigation', () => {
  test('is none at the mount, and follows each move of the first month', async () => {
    const { group, move } = await mountCalendar();
    expect(group).toHaveAttribute('data-navigation-direction', 'none');
    await move('next');
    expect(group).toHaveAttribute('data-navigation-direction', 'next');
    await move('previous');
    expect(group).toHaveAttribute('data-navigation-direction', 'previous');
  });
});

describe('a keyed grid in <Transition>', () => {
  test('leaves and enters with the classes of its name; the grid that leaves is inert', async () => {
    const { container, move } = await mountCalendar({ transition: 'calendar-slide' });
    const old = container.querySelector('[role=grid]')!;
    await move('next');
    expect(old).toHaveClass('calendar-slide-leave-active');
    expect(old).toHaveAttribute('inert');
    const grids = container.querySelectorAll('[role=grid]');
    expect(grids).toHaveLength(2);
    expect(grids[1]).toHaveClass('calendar-slide-enter-active');
    await waitFor(() => expect(container.querySelectorAll('[role=grid]')).toHaveLength(1));
  });

  test('a caption that stays changes its text in place', async () => {
    const { container, move } = await mountCalendar({ transition: 'calendar-slide' });
    const caption = container.querySelector('[role=group] [aria-live=polite]')!;
    await move('next');
    expect(container.querySelector('[role=group] [aria-live=polite]')).toBe(caption);
    expect(caption).toHaveTextContent('December 2026');
  });
});
