import type { DayState } from '../../internals/date-time/calendar/dayState';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import * as CalendarDayDataAttributes from './CalendarDayDataAttributes';

export const dayStateAttributesMapping: StateAttributesMapping<DayState> = {
  // The default mapping writes `data-outsidemonth`.
  outsideMonth: (value) => (value ? { [CalendarDayDataAttributes.outsideMonth]: '' } : null),
};
