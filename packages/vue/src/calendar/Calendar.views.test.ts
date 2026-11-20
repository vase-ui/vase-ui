import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { CalendarRootChangeEventDetails } from '@vase-ui/vue/calendar';
import CalendarParts from '../../test/fixtures/CalendarParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const day = (value: string) => Temporal.PlainDate.from(value);
const month = (value: string) => Temporal.PlainYearMonth.from(value);
const today = day('2026-11-18');

async function mountCalendar(root: Record<string, unknown> = {}) {
  const log: string[] = [];
  const props = reactive<Record<string, unknown>>({
    today,
    locale: 'en-US',
    onViewChange: (view: string, details: CalendarRootChangeEventDetails) =>
      log.push(`viewChange ${view} ${details.reason}`),
    onValueChange: (value: unknown, details: CalendarRootChangeEventDetails) =>
      log.push(`valueChange ${String(value)} ${details.reason}`),
    ...root,
  });
  const { root: container } = mount(CalendarParts, { views: true, root: props });
  await nextTick();
  const query = (selector: string) => container.querySelector<HTMLElement>(selector);
  return {
    log,
    props,
    container,
    group: query('[role=group]')!,
    trigger: () => query('[aria-live=polite][type=button]')!,
    monthCell: (value: string) => query(`[data-month="${value}"]`)!,
    yearCell: (value: number) => query(`[data-year="${value}"]`)!,
    grid: () => query('[role=grid]')!,
  };
}

describe('the view trigger', () => {
  test('shows the years, and the days again at a second press', async () => {
    const { trigger, group, grid, log } = await mountCalendar();
    expect(trigger()).toHaveTextContent('November 2026');
    expect(trigger()).not.toHaveAttribute('data-active');
    trigger().click();
    await nextTick();
    expect(log).toEqual(['viewChange year trigger-press']);
    expect(group).toHaveAttribute('data-view', 'year');
    expect(grid().tagName).toBe('DIV');
    expect(grid()).toHaveAttribute('aria-label', 'year');
    expect(trigger()).toHaveTextContent('2016 – 2027');
    expect(trigger()).toHaveAttribute('data-active');
    trigger().click();
    await nextTick();
    expect(grid().tagName).toBe('TABLE');
  });

  test('is disabled with visibleDuration', async () => {
    const { trigger } = await mountCalendar({ visibleDuration: { weeks: 1 } });
    expect(trigger()).toBeDisabled();
  });
});

describe('the cells', () => {
  test('a press on a year shows its months, and a press on a month shows its days', async () => {
    const { trigger, yearCell, monthCell, log, group } = await mountCalendar();
    trigger().click();
    await nextTick();
    expect(yearCell(2026)).toHaveAttribute('aria-selected', 'false');
    expect(yearCell(2026)).toHaveAttribute('aria-current', 'date');
    yearCell(2025).click();
    await nextTick();
    expect(group).toHaveAttribute('data-view', 'month');
    expect(monthCell('2025-11')).toHaveAttribute('aria-label', 'November 2025');
    monthCell('2025-03').click();
    await nextTick();
    expect(group).toHaveAttribute('data-view', 'day');
    expect(group).toHaveAttribute('aria-label', 'March 2025');
    expect(log).toEqual([
      'viewChange year trigger-press',
      'viewChange month year-press',
      'viewChange day month-press',
    ]);
  });

  test('a value that is a year and month selects a month, in the grid of months', async () => {
    const { monthCell, log, group } = await mountCalendar({ defaultValue: month('2026-05') });
    expect(group).toHaveAttribute('data-view', 'month');
    expect(monthCell('2026-05')).toHaveAttribute('aria-selected', 'true');
    monthCell('2026-08').click();
    expect(log).toEqual(['valueChange 2026-08 month-press']);
  });

  test('a month out of the limits or of disabledMonths is disabled', async () => {
    const { monthCell } = await mountCalendar({
      defaultView: 'month',
      max: day('2026-10-15'),
      disabledMonths: (value: Temporal.PlainYearMonth) => value.month === 2,
    });
    expect(monthCell('2026-11')).toBeDisabled();
    expect(monthCell('2026-02')).toBeDisabled();
    expect(monthCell('2026-10')).not.toBeDisabled();
  });

  test('the arrow keys move by a cell and by a row, and the page follows', async () => {
    const { monthCell } = await mountCalendar({ defaultView: 'month' });
    monthCell('2026-11').focus();
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(document.activeElement).toBe(monthCell('2026-08')));
    await userEvent.keyboard('{ArrowRight}{End}');
    await waitFor(() => expect(document.activeElement).toBe(monthCell('2026-09')));
    await userEvent.keyboard('{PageDown}');
    await waitFor(() => expect(document.activeElement).toBe(monthCell('2027-09')));
  });

  test('a new view gives the focus that a cell has to the tab stop of the new grid', async () => {
    const { yearCell } = await mountCalendar({ defaultView: 'year' });
    yearCell(2025).focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-month', '2025-11'));
  });
});
