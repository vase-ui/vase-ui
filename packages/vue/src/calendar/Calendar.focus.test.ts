import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { CalendarRootChangeEventDetails } from '@vase-ui/vue/calendar';
import CalendarParts from '../../test/fixtures/CalendarParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const day = (value: string) => Temporal.PlainDate.from(value);
// 2026-11-18 is a Wednesday. The weeks start on Monday.
const today = day('2026-11-18');

async function mountCalendar(setup: Record<string, unknown> = {}) {
  const log: string[] = [];
  const root = reactive<Record<string, unknown>>({
    today,
    locale: 'en-US',
    onMonthChange: (month: Temporal.PlainYearMonth, details: CalendarRootChangeEventDetails) =>
      log.push(`monthChange ${month} ${details.reason}`),
    'onUpdate:month': (month: Temporal.PlainYearMonth) => log.push(`update:month ${month}`),
    onFocusedDateChange: (date: Temporal.PlainDate, details: CalendarRootChangeEventDetails) =>
      log.push(`focusedDateChange ${date} ${details.reason}`),
    'onUpdate:focusedDate': (date: Temporal.PlainDate) => log.push(`update:focusedDate ${date}`),
    ...(setup.root as object),
  });
  const { root: container, exposed } = mount(CalendarParts, { ...setup, root });
  await nextTick();
  const button = (date: string) =>
    container.querySelector<HTMLButtonElement>(`[data-date="${date}"] button`);
  return {
    container,
    exposed,
    root,
    log,
    button,
    tabStops: () =>
      [...container.querySelectorAll('[role=grid] [tabindex="0"]')].map((element) =>
        element.closest('[data-date]')?.getAttribute('data-date'),
      ),
    focused: () => document.activeElement?.closest('[data-date]')?.getAttribute('data-date'),
    /** Focuses `date` and presses `keys`. */
    async press(date: string, keys: string) {
      button(date)!.focus();
      log.length = 0;
      await userEvent.keyboard(keys);
      await nextTick();
      await nextTick();
    },
  };
}

describe('the tab stop', () => {
  test.each([
    { name: 'the focused day', root: { defaultFocusedDate: day('2026-11-03') }, expected: '2026-11-03' },
    { name: 'the selected day', root: { defaultValue: day('2026-11-05') }, expected: '2026-11-05' },
    { name: 'today', root: {}, expected: '2026-11-18' },
    { name: 'the first day', root: { today: day('2026-12-24'), defaultMonth: Temporal.PlainYearMonth.from('2026-11') }, expected: '2026-11-01' },
  ])('is one day: $name', async ({ root, expected }) => {
    const { tabStops } = await mountCalendar({ root });
    expect(tabStops()).toEqual([expected]);
  });

  test('takes the focus of Tab, and the next Tab leaves the grid', async () => {
    const { container } = await mountCalendar({ parts: {} });
    container.querySelectorAll<HTMLElement>('[role=group] > button')[1]!.focus();
    await userEvent.tab();
    expect(document.activeElement).toHaveAttribute('aria-label', 'Wednesday, November 18, 2026');
    await userEvent.tab();
    expect(document.activeElement?.id).toBe('after');
  });

  test('a day that gets the focus becomes the focused day', async () => {
    const { button, log } = await mountCalendar();
    button('2026-11-10')!.focus();
    await nextTick();
    expect(log).toEqual(['focusedDateChange 2026-11-10 none', 'update:focusedDate 2026-11-10']);
  });
});

describe('the keys', () => {
  test.each([
    { keys: '{ArrowRight}', expected: '2026-11-19' },
    { keys: '{ArrowLeft}', expected: '2026-11-17' },
    { keys: '{ArrowDown}', expected: '2026-11-25' },
    { keys: '{ArrowUp}', expected: '2026-11-11' },
    { keys: '{Home}', expected: '2026-11-16' },
    { keys: '{End}', expected: '2026-11-22' },
  ])('$keys moves the focus to $expected', async ({ keys, expected }) => {
    const { press, focused } = await mountCalendar();
    await press('2026-11-18', keys);
    expect(focused()).toBe(expected);
  });

  test('a key to a day of another page moves the page first: monthChange, then focusedDateChange, then the focus', async () => {
    const { press, focused, log } = await mountCalendar();
    await press('2026-11-18', '{PageDown}');
    expect(log).toEqual([
      'monthChange 2026-12 keyboard',
      'update:month 2026-12',
      'focusedDateChange 2026-12-18 keyboard',
      'update:focusedDate 2026-12-18',
    ]);
    expect(focused()).toBe('2026-12-18');
    await press('2026-12-18', '{Shift>}{PageUp}{/Shift}');
    expect(focused()).toBe('2025-12-18');
  });

  test('a cancel of the month keeps the page and the focus', async () => {
    const { press, focused, root } = await mountCalendar();
    root.onMonthChange = (_: unknown, details: CalendarRootChangeEventDetails) => details.cancel();
    await nextTick();
    await press('2026-11-30', '{ArrowRight}');
    expect(focused()).toBe('2026-11-30');
  });

  test('a key skips a day that takes no focus and stops at max', async () => {
    const { press, focused } = await mountCalendar({
      root: { disabledDates: day('2026-11-19'), max: day('2026-11-21') },
    });
    await press('2026-11-18', '{ArrowRight}');
    expect(focused()).toBe('2026-11-20');
    await press('2026-11-20', '{ArrowDown}');
    expect(focused()).toBe('2026-11-21');
    await press('2026-11-21', '{ArrowRight}');
    expect(focused()).toBe('2026-11-21');
  });

  test('ArrowLeft is the next day with the direction right-to-left of an ancestor', async () => {
    const { press, focused, container } = await mountCalendar();
    container.dir = 'rtl';
    await press('2026-11-18', '{ArrowLeft}');
    expect(focused()).toBe('2026-11-19');
  });

  test('a key that a listener of the button stops does nothing', async () => {
    const stop = (event: KeyboardEvent) => event.stopPropagation();
    const { press, focused } = await mountCalendar({ dayButton: { onKeydown: stop } });
    await press('2026-11-18', '{ArrowRight}');
    expect(focused()).toBe('2026-11-18');
  });

  test('Ctrl with an arrow key does nothing', async () => {
    const { press, focused } = await mountCalendar();
    await press('2026-11-18', '{Control>}{ArrowRight}{/Control}');
    expect(focused()).toBe('2026-11-18');
  });
});

describe('focus() and autofocus', () => {
  test('focus() gives the tab stop the focus; focus(date) shows the page of the day with update:month only', async () => {
    const { exposed, focused, log } = await mountCalendar();
    exposed.root.focus();
    await waitFor(() => expect(focused()).toBe('2026-11-18'));
    log.length = 0;
    exposed.root.focus(day('2027-01-05'));
    await waitFor(() => expect(focused()).toBe('2027-01-05'));
    expect(log).toEqual(['update:month 2027-01', 'update:focusedDate 2027-01-05']);
  });

  test('autofocus gives the tab stop the focus at the mount', async () => {
    const { focused } = await mountCalendar({ root: { autofocus: true } });
    await waitFor(() => expect(focused()).toBe('2026-11-18'));
  });
});

describe('a write of the parent', () => {
  test('a new focusedDate shows its page with update:month only, and moves the focus that a day has', async () => {
    const { root, button, focused, log } = await mountCalendar({
      root: { focusedDate: day('2026-11-18') },
    });
    button('2026-11-18')!.focus();
    log.length = 0;
    root.focusedDate = day('2027-02-02');
    await waitFor(() => expect(focused()).toBe('2027-02-02'));
    expect(log).toEqual(['update:month 2027-02']);
  });

  test('a new focusedDate takes no focus from an element outside the grid', async () => {
    const { root, container } = await mountCalendar({ root: { focusedDate: day('2026-11-18') } });
    const after = container.querySelector<HTMLElement>('#after')!;
    after.focus();
    root.focusedDate = day('2026-11-20');
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(after);
  });
});
