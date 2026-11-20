import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { RangeCalendarRootChangeEventDetails } from '@vase-ui/vue/range-calendar';
import { dataAttributes } from '../../test/field';
import CalendarParts from '../../test/fixtures/CalendarParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const day = (value: string) => Temporal.PlainDate.from(value);
// 2026-11-18 is a Wednesday. The weeks of en-US start on Sunday.
const today = day('2026-11-18');

async function mountRange(root: Record<string, unknown> = {}, setup: Record<string, unknown> = {}) {
  const log: string[] = [];
  const props = reactive<Record<string, unknown>>({
    today,
    locale: 'en-US',
    onValueChange: (value: unknown[], details: RangeCalendarRootChangeEventDetails) =>
      log.push(`valueChange ${value.map(String).join(' ')} ${details.reason}`),
    ...root,
  });
  const { root: container } = mount(CalendarParts, { ...setup, range: true, root: props });
  await nextTick();
  const cell = (date: string) => container.querySelector<HTMLElement>(`[data-date="${date}"]`)!;
  const find = (name: string) =>
    [...container.querySelectorAll(`td[${name}]`)].map((element) =>
      element.getAttribute('data-date'),
    );
  return {
    log,
    props,
    container,
    group: container.querySelector<HTMLElement>('[role=group]')!,
    cell,
    button: (date: string) => cell(date).querySelector('button')!,
    shown: () => ({
      start: find('data-range-start'),
      middle: find('data-range-middle'),
      end: find('data-range-end'),
    }),
  };
}

describe('the range', () => {
  test('a press starts a range, and a press on a day before it ends the range in the order of the calendar', async () => {
    const { button, log, shown, group } = await mountRange();
    button('2026-11-12').click();
    await nextTick();
    expect(log).toEqual(['valueChange 2026-11-12 null day-press']);
    expect(group).toHaveAttribute('data-selecting');
    button('2026-11-10').click();
    await nextTick();
    expect(log[1]).toBe('valueChange 2026-11-10 2026-11-12 day-press');
    expect(shown()).toEqual({ start: ['2026-11-10'], middle: ['2026-11-11'], end: ['2026-11-12'] });
    expect(group).not.toHaveAttribute('data-selecting');
  });

  test('a day and its button write the range attributes, and the button has touch-action: none', async () => {
    const { cell, button } = await mountRange({
      defaultValue: [day('2026-11-10'), day('2026-11-12')],
    });
    expect(cell('2026-11-11')).toHaveAttribute('aria-selected', 'true');
    expect(dataAttributes(button('2026-11-10'))).toEqual(['data-range-start', 'data-selected']);
    expect(button('2026-11-11').style.touchAction).toBe('none');
  });

  test('a press that makes a range longer than maxDays starts a new range', async () => {
    const { button, log } = await mountRange({ maxDays: 3 });
    button('2026-11-10').click();
    button('2026-11-14').click();
    expect(log).toEqual([
      'valueChange 2026-11-10 null day-press',
      'valueChange 2026-11-14 null day-press',
    ]);
  });

  test('a press that makes a range shorter than minDays starts a new range', async () => {
    const { button, log } = await mountRange({ minDays: 3 });
    button('2026-11-10').click();
    button('2026-11-11').click();
    expect(log).toEqual([
      'valueChange 2026-11-10 null day-press',
      'valueChange 2026-11-11 null day-press',
    ]);
  });

  test('a new end has the kind, the time and the zone of the end that it replaces', async () => {
    const tokyo = (date: string) => Temporal.ZonedDateTime.from(`${date}T09:30[Asia/Tokyo]`);
    const { button, log } = await mountRange({
      defaultValue: [tokyo('2026-11-02'), tokyo('2026-11-04')],
    });
    button('2026-11-10').click();
    expect(log).toEqual(['valueChange 2026-11-10T09:30:00+09:00[Asia/Tokyo] null day-press']);
  });

  test('a read-only range takes no press, no preview and no Escape', async () => {
    const { button, log, shown } = await mountRange({
      readonly: true,
      defaultValue: [day('2026-11-10'), null],
    });
    button('2026-11-12').click();
    await userEvent.hover(button('2026-11-13'));
    button('2026-11-13').focus();
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(log).toEqual([]);
    expect(shown()).toEqual({ start: ['2026-11-10'], middle: [], end: ['2026-11-10'] });
  });

  test('a range does not cross an unavailable day, unless allowNonContiguousRanges', async () => {
    const unavailableDates = day('2026-11-11');
    const blocked = await mountRange({ unavailableDates });
    blocked.button('2026-11-10').click();
    blocked.button('2026-11-12').click();
    expect(blocked.log[1]).toBe('valueChange 2026-11-12 null day-press');
    const crossed = await mountRange({ unavailableDates, allowNonContiguousRanges: true });
    crossed.button('2026-11-10').click();
    crossed.button('2026-11-12').click();
    await nextTick();
    expect(crossed.log[1]).toBe('valueChange 2026-11-10 2026-11-12 day-press');
  });

  test('a hover shows the range in progress before the second press', async () => {
    const { button, shown } = await mountRange();
    button('2026-11-10').click();
    await userEvent.hover(button('2026-11-13'));
    await nextTick();
    expect(shown()).toEqual({
      start: ['2026-11-10'],
      middle: ['2026-11-11', '2026-11-12'],
      end: ['2026-11-13'],
    });
  });

  test('a day that gets the focus shows the range in progress', async () => {
    const { button, shown } = await mountRange();
    button('2026-11-10').click();
    button('2026-11-12').focus();
    await nextTick();
    expect(shown().end).toEqual(['2026-11-12']);
  });

  test('Escape on each element of the root puts back the range from before the first press', async () => {
    const { button, log, group } = await mountRange({
      defaultValue: [day('2026-11-02'), day('2026-11-04')],
    });
    button('2026-11-10').click();
    group.querySelector<HTMLElement>(':scope > button')!.focus();
    await userEvent.keyboard('{Escape}');
    expect(log.at(-1)).toBe('valueChange 2026-11-02 2026-11-04 keyboard');
  });

  test('Shift with an arrow key extends the range', async () => {
    const { button, log } = await mountRange();
    button('2026-11-10').focus();
    await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}');
    await waitFor(() => expect(log.at(-1)).toBe('valueChange 2026-11-10 2026-11-12 keyboard'));
  });

  test('a parent that keeps its range keeps the days', async () => {
    const { button, shown, props } = await mountRange({
      modelValue: [day('2026-11-02'), day('2026-11-03')],
    });
    props['onUpdate:modelValue'] = () => {};
    await nextTick();
    button('2026-11-20').click();
    await nextTick();
    expect(shown().start).toEqual(['2026-11-02']);
  });
});

describe('the views', () => {
  test('the view trigger is disabled, and the grids of months and years render nothing', async () => {
    const { container } = await mountRange({}, { views: true });
    expect(container.querySelector('[aria-live=polite][type=button]')).toBeDisabled();
    expect(container.querySelectorAll('[role=grid]')).toHaveLength(1);
  });
});
