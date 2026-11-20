import type { InjectionKey } from 'vue';

/**
 * What a part that renders `RangeCalendar.Root` gives to the root, such as the calendar of a range
 * picker. The root has no prop and no event for it.
 */
export interface RangeCalendarHost {
  /** A drag ends on the range that the root already has. The root emits no change for it. */
  onSameRange(event: PointerEvent): void;
}

export const rangeCalendarHostKey: InjectionKey<RangeCalendarHost> = Symbol('range calendar host');
