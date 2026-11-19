import { computed, inject, toValue } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import { formatNumber } from '../../common/formatNumber';
import { useIsHydrating } from '../../common/hydration';
import { isElementDisabled } from '../../common/isElementDisabled';
import type { CompositeMetadata } from '../../internals/composite/list/useCompositeList';
import { useCompositeItem } from '../../internals/composite/root/useCompositeRoot';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { dayPeriodText, hourCycleOf } from '../../internals/date-time/format';
import type { DateTimePickerContext } from '../../internals/date-time/picker/useDateTimePickerRoot';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { withTime } from '../../internals/date-time/temporal';
import { REASONS } from '../../internals/reasons';
import {
  dayPeriodOf,
  faceNumber,
  faceNumberOf,
  isTimeAllowed,
  timeOfDayPeriod,
  timeOfFaceNumber,
} from '../../time-clock/utils/clockViews';
import type {
  TimeClockDayPeriodValue,
  TimeClockHourCycle,
  TimeClockView,
  TimeLimits,
} from '../../time-clock/utils/clockViews';
import { useFormatLocale } from '../../utils/useFormatLocale';
import type {
  TimePickerRootChangeEventDetails,
  TimePickerRootProps,
  TimePickerRootValue,
} from './TimePickerRoot.vue';

export interface TimePickerRootContext extends DateTimePickerContext<
  TimePickerRootValue | null,
  TimePickerRootValue,
  TimePickerRootChangeEventDetails
> {
  props: Readonly<TimePickerRootProps<TimePickerRootValue>>;
  referenceTime: ComputedRef<Temporal.PlainTime>;
  time: ComputedRef<Temporal.PlainTime>;
}

export const TimePickerRootContext: InjectionKey<TimePickerRootContext> = Symbol();

export function useTimePickerRootContext(): TimePickerRootContext {
  const context = inject(TimePickerRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Time Picker must be inside <TimePicker.Root>. Without a root the part has no value and no popup to share. Put the part inside <TimePicker.Root>.',
    );
  }

  return context;
}

/** The unit that a column of the time picker sets. */
export type TimePickerColumnUnit = TimeClockView | 'dayPeriod';

/** A number for a column of hours, minutes or seconds, and a day period for a column of day periods. */
export type TimePickerColumnValue = number | TimeClockDayPeriodValue;

export interface TimePickerColumnContext {
  unit: ComputedRef<TimePickerColumnUnit>;
  selectedValue: ComputedRef<TimePickerColumnValue | null>;
  closeOnSelect: ComputedRef<boolean>;
}

export const TimePickerColumnContext: InjectionKey<TimePickerColumnContext> = Symbol();

export function useTimePickerColumnContext(): TimePickerColumnContext {
  const context = inject(TimePickerColumnContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <TimePicker.ColumnItem> must be inside <TimePicker.Column>. Without a column the item has no unit to set. Put the item inside <TimePicker.Column>.',
    );
  }

  return context;
}

export function columnValues(
  unit: TimePickerColumnUnit,
  hourCycle: TimeClockHourCycle,
  step: number,
): TimePickerColumnValue[] {
  if (unit === 'dayPeriod') {
    return ['am', 'pm'];
  }
  if (unit === 'hour') {
    return Array.from({ length: hourCycle }, (_, hour) => hour)
      .filter((hour) => hour % step === 0)
      .map((hour) => (hourCycle === 12 && hour === 0 ? 12 : hour));
  }
  return Array.from({ length: Math.ceil(60 / step) }, (_, place) => place * step);
}

export function selectedColumnValue(
  unit: TimePickerColumnUnit,
  hourCycle: TimeClockHourCycle,
  time: Temporal.PlainTime,
): TimePickerColumnValue {
  return unit === 'dayPeriod' ? dayPeriodOf(time) : faceNumberOf(unit, hourCycle, time).value;
}

/** `time` with the unit of the column set to `value`. An hour of a 12-hour cycle keeps the day period. */
export function timeOfColumnValue(
  unit: TimePickerColumnUnit,
  hourCycle: TimeClockHourCycle,
  time: Temporal.PlainTime,
  value: TimePickerColumnValue,
): Temporal.PlainTime {
  if (unit === 'dayPeriod') {
    return timeOfDayPeriod(time, value === 'pm' ? 'pm' : 'am');
  }
  return timeOfFaceNumber(unit, hourCycle, time, faceNumber(unit, hourCycle, Number(value)));
}

export function isColumnValueAllowed(
  unit: TimePickerColumnUnit,
  hourCycle: TimeClockHourCycle,
  time: Temporal.PlainTime,
  value: TimePickerColumnValue,
  limits: TimeLimits,
): boolean {
  if (unit === 'dayPeriod') {
    const firstHour = value === 'pm' ? 12 : 0;
    return Array.from({ length: 12 }, (_, hour) => time.with({ hour: firstHour + hour })).some(
      (candidate) => isTimeAllowed(candidate, 'hour', limits),
    );
  }
  return isTimeAllowed(timeOfColumnValue(unit, hourCycle, time, value), unit, limits);
}

export function columnText(
  unit: TimePickerColumnUnit,
  hourCycle: TimeClockHourCycle,
  value: TimePickerColumnValue,
  locale: Intl.LocalesArgument,
): string {
  if (unit === 'dayPeriod') {
    return dayPeriodText(value === 'pm' ? 'pm' : 'am', locale);
  }
  return formatNumber(Number(value), locale, {
    minimumIntegerDigits: unit === 'hour' && hourCycle === 12 ? 1 : 2,
  });
}

export function useTimePickerFormat(picker: TimePickerRootContext) {
  const locale = useFormatLocale(() => picker.props.locale);
  const hourCycle = computed(() => picker.props.hourCycle ?? hourCycleOf(locale.value));
  return { locale, hourCycle };
}

export function hourCycleOption(
  hourCycle: TimeClockHourCycle | undefined,
): 'h12' | 'h23' | undefined {
  return hourCycle === undefined ? undefined : hourCycle === 12 ? 'h12' : 'h23';
}

/** The selected enabled option, or the first enabled option in index order. */
export function findOptionToFocus(
  options: ReadonlyMap<Element, CompositeMetadata<unknown>>,
): Element | undefined {
  let firstEnabled: Element | undefined;
  for (const [option, { itemState }] of options) {
    if (
      !option.isConnected ||
      toValue(itemState?.disabled) ||
      isElementDisabled(option) ||
      option.matches(':disabled')
    ) {
      continue;
    }
    if (toValue(itemState?.selected)) {
      return option;
    }
    firstEnabled ??= option;
  }
  return firstEnabled;
}

interface UseTimePickerOptionParameters {
  picker: TimePickerRootContext;
  selected: ComputedRef<boolean>;
  disabled: ComputedRef<boolean>;
  closeOnSelect: ComputedRef<boolean>;
  time: () => Temporal.PlainTime;
}

export function useTimePickerOption(
  element: Readonly<Ref<HTMLElement | null>>,
  parameters: UseTimePickerOptionParameters,
) {
  const { picker, selected, disabled } = parameters;
  const popup = usePickerPopup();
  const isHydrating = useIsHydrating();
  const item = useCompositeItem(element, {
    active: selected,
    selected,
    disabled,
  });

  // A press on the selected option still honors closeOnSelect.
  function select(event: MouseEvent | KeyboardEvent) {
    if (disabled.value || picker.props.readOnly) {
      return;
    }
    if (!selected.value) {
      const details = createChangeEventDetails(REASONS.itemPress, event);
      picker.commit(withTime(picker.template.value, parameters.time()), details);
      if (details.isCanceled) {
        return;
      }
    }
    if (parameters.closeOnSelect.value) {
      popup.closeAfterSelection(event);
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      select(event);
    }
  }

  return function optionProps() {
    return [
      item.attributes.value,
      item.events,
      {
        role: 'option',
        'aria-selected': selected.value,
        'aria-disabled': disabled.value || undefined,
        // The server and browser can have different locale data.
        'data-allow-mismatch': isHydrating.value ? 'attribute,text' : undefined,
        onClick: select,
        onKeydown,
      },
    ];
  };
}
