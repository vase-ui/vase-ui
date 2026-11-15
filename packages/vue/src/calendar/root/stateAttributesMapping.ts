import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { CalendarRootState } from './CalendarRoot.vue';
import * as CalendarRootDataAttributes from './CalendarRootDataAttributes';

// The default mapping writes `data-multiplemonths` and `data-navigationdirection`.
export const calendarRootStateAttributesMapping: StateAttributesMapping<CalendarRootState> = {
  multipleMonths: (value) => (value ? { [CalendarRootDataAttributes.multipleMonths]: '' } : null),
  navigationDirection: (value) => ({ [CalendarRootDataAttributes.navigationDirection]: value }),
  broadcastCalendar: (value) =>
    value ? { [CalendarRootDataAttributes.broadcastCalendar]: '' } : null,
};
