import { dayStateAttributesMapping } from '../../calendar/day/stateAttributesMapping';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { RangeCalendarDayState } from './RangeCalendarDay.vue';
import * as RangeCalendarDayDataAttributes from './RangeCalendarDayDataAttributes';

// The default mapping writes `data-rangestart`, `data-rangeend` and `data-rangemiddle`.
export const rangeDayStateAttributesMapping: StateAttributesMapping<RangeCalendarDayState> = {
  ...dayStateAttributesMapping,
  rangeStart: (value) => (value ? { [RangeCalendarDayDataAttributes.rangeStart]: '' } : null),
  rangeEnd: (value) => (value ? { [RangeCalendarDayDataAttributes.rangeEnd]: '' } : null),
  rangeMiddle: (value) => (value ? { [RangeCalendarDayDataAttributes.rangeMiddle]: '' } : null),
};
