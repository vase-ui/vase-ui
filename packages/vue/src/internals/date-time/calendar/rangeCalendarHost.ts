import { inject } from 'vue';
import type { InjectionKey } from 'vue';

/**
 * What a part that renders `RangeCalendar.Root` gives to the root, such as the calendar of a range
 * picker. The root has no prop and no event for it, so a consumer cannot give it.
 */
export interface RangeCalendarHost {
  /**
   * Called when a drag ends on the range that the root already has. The root emits no change for
   * such a drag, but the drag still picks that range.
   */
  onSameRange: (event: PointerEvent) => void;
}

export const RangeCalendarHostContext: InjectionKey<RangeCalendarHost> = Symbol();

/** The host of the root, or `undefined` when no part gives one. */
export function useRangeCalendarHost(): RangeCalendarHost | undefined {
  return inject(RangeCalendarHostContext, undefined);
}
