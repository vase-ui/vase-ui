import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { effectScope, shallowReactive } from 'vue';
import { useDaySelection } from './daySelection';
import type { DaySelectionProps } from './daySelection';
import { useRangeSelection } from './rangeSelection';
import type { RangeSelectionProps } from './rangeSelection';

describe('calendar selection template', () => {
  const date = () => Temporal.PlainDate.from('2026-11-14');
  const next = () => Temporal.ZonedDateTime.from('2026-11-16T09:30[Asia/Tokyo]');

  it('keeps the last day when a consumer clears the selection in the same task', () => {
    const props = shallowReactive<DaySelectionProps>({ modelValue: date() });
    const scope = effectScope();
    onTestFinished(() => scope.stop());
    const selection = scope.run(() => useDaySelection(props, vi.fn()))!;
    const zoned = next();

    props.modelValue = zoned;
    props.modelValue = null;

    expect(selection.template.value).toBe(zoned);
  });

  it('keeps the last end when a consumer clears the range in the same task', () => {
    const props = shallowReactive<RangeSelectionProps>({ modelValue: [date(), null] });
    const scope = effectScope();
    onTestFinished(() => scope.stop());
    const selection = scope.run(() => useRangeSelection(props, vi.fn()))!;
    const zoned = next();

    props.modelValue = [null, zoned];
    props.modelValue = [null, null];

    expect(selection.template.value).toBe(zoned);
  });
});
