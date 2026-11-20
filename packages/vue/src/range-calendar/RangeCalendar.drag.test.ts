import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { RangeCalendarRootChangeEventDetails } from '@vase-ui/vue/range-calendar';
import CalendarParts from '../../test/fixtures/CalendarParts.vue';
import { mount } from '../../test/render';

const day = (value: string) => Temporal.PlainDate.from(value);
const today = day('2026-11-18');

afterEach(async () => {
  await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
});

async function mountRange(root: Record<string, unknown> = {}) {
  const log: string[] = [];
  const props = reactive<Record<string, unknown>>({
    today,
    locale: 'en-US',
    onValueChange: (value: unknown[], details: RangeCalendarRootChangeEventDetails) =>
      log.push(`valueChange ${value.map(String).join(' ')} ${details.reason}`),
    ...root,
  });
  const { root: container } = mount(CalendarParts, { range: true, root: props });
  await nextTick();
  const button = (date: string) =>
    container.querySelector<HTMLElement>(`[data-date="${date}"] button`)!;
  const at = (date: string) => {
    const rect = button(date).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const find = (name: string) =>
    [...container.querySelectorAll(`td[${name}]`)].map((element) =>
      element.getAttribute('data-date'),
    );
  return {
    log,
    props,
    container,
    button,
    at,
    shown: () => ({ start: find('data-range-start'), end: find('data-range-end') }),
  };
}

describe('a drag with the real pointer', () => {
  test('makes a range in one change, and its click is no press', async () => {
    const { at, log, shown } = await mountRange();
    await userEvent.pointer([
      { coords: at('2026-11-10'), keys: '[MouseLeft>]' },
      { coords: at('2026-11-11') },
      { coords: at('2026-11-12') },
    ]);
    expect(shown()).toEqual({ start: ['2026-11-10'], end: ['2026-11-12'] });
    expect(log).toEqual([]);
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await nextTick();
    expect(log).toEqual(['valueChange 2026-11-10 2026-11-12 drag']);
  });

  test('stops at the last day that maxDays allows', async () => {
    const { at, log } = await mountRange({ maxDays: 2 });
    await userEvent.pointer([
      { coords: at('2026-11-10'), keys: '[MouseLeft>]' },
      { coords: at('2026-11-13') },
      { keys: '[/MouseLeft]' },
    ]);
    expect(log).toEqual(['valueChange 2026-11-10 2026-11-11 drag']);
  });

  test('ends when the button of its first day leaves the document', async () => {
    const { at, log, props, container, shown } = await mountRange();
    await userEvent.pointer([
      { coords: at('2026-11-10'), keys: '[MouseLeft>]' },
      { coords: at('2026-11-12') },
    ]);
    props.hiddenDates = day('2026-11-10');
    await nextTick();
    const below = container.getBoundingClientRect().bottom + 40;
    await userEvent.pointer([{ coords: { x: 2, y: below } }, { keys: '[/MouseLeft]' }]);
    await userEvent.hover(container.querySelector('[data-date="2026-11-14"] button')!);
    await nextTick();
    expect(log).toEqual([]);
    expect(shown()).toEqual({ start: [], end: [] });
  });
});
