import {
  computed,
  inject,
  onMounted,
  provide,
  shallowReactive,
  shallowRef,
  toValue,
  watch,
  watchPostEffect,
} from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { clamp } from '../../../common/clamp';
import { useAriaAfterHydration, useHiddenValueBeforeHydration } from '../../../common/hydration';
import { ownerWindow } from '../../../common/owner';
import { contains } from '../../../common/shadowDom';
import { useControlled } from '../../../common/useControlled';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../../common/visuallyHidden';
import { useFieldsetDisabled } from '../../../fieldset/root/useFieldsetDisabled';
import { useFormatLocale } from '../../../utils/useFormatLocale';
import { createChangeEventDetails } from '../../createVaseUIEventDetails';
import { useFieldControl, useInputRegistration } from '../../field-register-control';
import { fieldValidityMapping } from '../../field-constants';
import { useClearFieldError, useFieldRootContext } from '../../field-root-context';
import { useFormContext } from '../../form-context';
import { handleHiddenInputInvalid } from '../../handleHiddenInputInvalid';
import type { StateAttributesMapping } from '../../getStateAttributesProps';
import {
  useAriaLabelledBy,
  useControlLabelId,
  useLabelableContext,
  useLabelableId,
} from '../../labelable-provider';
import { REASONS } from '../../reasons';
import { useFormReset } from '../../useFormReset';
import { useFormRestoreAsInput } from '../../useFormRestore';
import { useValueChanged } from '../../useValueChanged';
import { displayCalendar } from '../displayCalendar';
import { digits as getDigits, formatter } from '../format';
import type { DateMatcher } from '../matchers';
import {
  isKind,
  kindOf,
  parseInputText,
  toInputText,
  toPlainDate,
  today,
  yearMonthInCalendar,
} from '../temporal';
import type { DateValue, TemporalKind, TemporalValue } from '../temporal';
import { DateTimeFieldContext } from './DateTimeFieldContext';
import { useDateTimeFieldHost } from './dateTimeFieldHost';
import type {
  DateTimeFieldChangeEventDetails,
  DateTimeFieldRootState,
  DateTimeFieldSegment,
  DateTimeFieldSegmentView,
  SegmentSpin,
} from './DateTimeFieldContext';
import { PARTIAL_MESSAGE, getInputLimits, getLimitMessage } from './customValidity';
import type { ValueLimits } from './customValidity';
import { PickerResetCountContext } from './PickerResetCountContext';
import { getSegmentAttributes } from './segmentAttributes';
import { getDayPeriodTexts, getFixedSegmentTexts, getSegmentLayout } from './segmentLayout';
import type { EditableSegmentType, SegmentLayoutOptions, TimeUnit } from './segmentLayout';
import {
  PLACEHOLDERS,
  fromNumbers,
  getLimits,
  getPadding,
  getRange,
  isNumericType,
  parseLocaleText,
  shiftYear,
  toNumbers,
  wrapNumber,
} from './segmentRanges';
import type {
  DayPeriod,
  Limits,
  NumbersContext,
  NumericSegmentType,
  SegmentNumbers,
} from './segmentRanges';

export type DateTimeFieldFamily = 'date' | 'time';
export type DateTimeFieldGranularity = 'month' | 'day' | 'hour' | 'minute' | 'second';

export const rootStateAttributesMapping: StateAttributesMapping<DateTimeFieldRootState> = {
  ...fieldValidityMapping,
};

// The default text that tells a screen reader that a segment has no number.
const EMPTY_TEXT = 'Empty';
const EMPTY_VIEW: DateTimeFieldSegmentView = {
  number: undefined,
  text: '',
  placeholder: '',
  min: 0,
  max: 0,
  valueText: undefined,
  label: '',
  size: 1,
  id: undefined,
};

const INPUT_TYPES: Partial<Record<TemporalKind, string>> = {
  date: 'date',
  dateTime: 'datetime-local',
  time: 'time',
};

const TIME_GRANULARITIES: readonly DateTimeFieldGranularity[] = ['hour', 'minute', 'second'];

export interface UseDateTimeFieldRootParameters<Value extends TemporalValue> {
  /** `date` has the date units of the granularity, and `time` has the time units only. */
  family: DateTimeFieldFamily;
  hiddenInputElement: Readonly<Ref<HTMLInputElement | null>>;
  value?: MaybeRefOrGetter<Value | null | undefined>;
  defaultValue?: MaybeRefOrGetter<Value | null | undefined>;
  referenceDate?: MaybeRefOrGetter<TemporalValue | undefined>;
  granularity?: MaybeRefOrGetter<DateTimeFieldGranularity | undefined>;
  hourCycle?: MaybeRefOrGetter<12 | 24 | undefined>;
  forceLeadingZeros?: MaybeRefOrGetter<boolean | undefined>;
  hideTimeZone?: MaybeRefOrGetter<boolean | undefined>;
  minDate?: MaybeRefOrGetter<DateValue | undefined>;
  maxDate?: MaybeRefOrGetter<DateValue | undefined>;
  unavailableDates?: MaybeRefOrGetter<DateMatcher | undefined>;
  minTime?: MaybeRefOrGetter<Temporal.PlainTime | undefined>;
  maxTime?: MaybeRefOrGetter<Temporal.PlainTime | undefined>;
  /** The `step` of the hidden input, in seconds. */
  step?: MaybeRefOrGetter<number | undefined>;
  locale?: MaybeRefOrGetter<Intl.LocalesArgument | undefined>;
  calendar?: MaybeRefOrGetter<string | undefined>;
  timeZone?: MaybeRefOrGetter<string | undefined>;
  disabled?: MaybeRefOrGetter<boolean | undefined>;
  readOnly?: MaybeRefOrGetter<boolean | undefined>;
  required?: MaybeRefOrGetter<boolean | undefined>;
  name?: MaybeRefOrGetter<string | undefined>;
  form?: MaybeRefOrGetter<string | undefined>;
  id?: MaybeRefOrGetter<string | undefined>;
  autoComplete?: MaybeRefOrGetter<string | undefined>;
  ariaLabelledby?: MaybeRefOrGetter<string | undefined>;
  /** Called with each new value. A call of `details.cancel()` keeps the old value. */
  valueChange: (value: Value | null, details: DateTimeFieldChangeEventDetails) => void;
  /** Called after `valueChange`, unless a listener canceled the change. */
  updateValue: (value: Value | null) => void;
}

function isSameValue(a: TemporalValue | null, b: unknown): boolean {
  if (a === null || b === null || b === undefined) {
    return a === null && (b === null || b === undefined);
  }
  if (isKind(a, 'date')) {
    return isKind(b, 'date') && a.equals(b);
  }
  if (isKind(a, 'time')) {
    return isKind(b, 'time') && a.equals(b);
  }
  if (isKind(a, 'dateTime')) {
    return isKind(b, 'dateTime') && a.equals(b);
  }
  if (isKind(a, 'zonedDateTime')) {
    return isKind(b, 'zonedDateTime') && a.equals(b);
  }
  return isKind(b, 'yearMonth') && a.equals(b);
}

function getKind(
  family: DateTimeFieldFamily,
  source: TemporalValue | undefined,
  granularity: DateTimeFieldGranularity | undefined,
): TemporalKind {
  const sourceKind = source && kindOf(source);
  if (sourceKind) {
    return sourceKind;
  }
  if (family === 'time') {
    return 'time';
  }
  if (granularity === 'month') {
    return 'yearMonth';
  }
  return granularity === undefined || granularity === 'day' ? 'date' : 'dateTime';
}

// The granularity that the kind allows. A value of another kind keeps its own kind.
function getGranularity(
  family: DateTimeFieldFamily,
  kind: TemporalKind,
  requested: DateTimeFieldGranularity | undefined,
): DateTimeFieldGranularity {
  if (family === 'time' || kind === 'time') {
    return requested && TIME_GRANULARITIES.includes(requested) ? requested : 'minute';
  }
  if (kind === 'yearMonth') {
    return 'month';
  }
  if (kind === 'date') {
    return requested === 'month' ? 'month' : 'day';
  }
  return requested ?? 'minute';
}

function isTimeUnit(granularity: DateTimeFieldGranularity): granularity is TimeUnit {
  return TIME_GRANULARITIES.includes(granularity);
}

/**
 * The state of a date field or a time field: its value, the numbers of its segments, its
 * validity, its hidden input and its place in a field. A root part calls it in `setup`, after
 * `assertTemporal`, and gives the result to its parts through the context that it provides.
 */
export function useDateTimeFieldRoot<Value extends TemporalValue>(
  parameters: UseDateTimeFieldRootParameters<Value>,
): DateTimeFieldContext {
  const { family, hiddenInputElement, valueChange, updateValue } = parameters;
  const {
    setDirty,
    validityData,
    disabled: fieldDisabled,
    setFilled,
    invalid: fieldInvalid,
    state: fieldState,
    validation,
    validationMode,
    setFocused: setFieldFocused,
    setTouched,
  } = useFieldRootContext();
  const { clearErrors } = useFormContext();
  const { getDescriptionProps } = useLabelableContext();
  const host = useDateTimeFieldHost();

  const fieldsetDisabled = useFieldsetDisabled(() => rootElement.value);
  const isDisabled = computed(
    () =>
      (fieldDisabled.value ?? false) ||
      fieldsetDisabled.value ||
      (toValue(parameters.disabled) ?? false),
  );
  const isReadOnly = computed(() => toValue(parameters.readOnly) ?? false);
  const isRequired = computed(() => toValue(parameters.required) ?? false);
  const locale = useFormatLocale(() => toValue(parameters.locale));

  const value = useControlled<Value | null>({
    controlled: () => toValue(parameters.value),
    default: () => toValue(parameters.defaultValue) ?? null,
    name: family === 'date' ? 'DateField' : 'TimeField',
    state: 'value',
  });

  // The value that gives the kind, the time and the zone of a new value. With no value, the default
  // value and then the reference date give them.
  const templateSource = computed<TemporalValue | undefined>(
    () => value.value ?? toValue(parameters.defaultValue) ?? toValue(parameters.referenceDate),
  );
  const kind = computed(() =>
    getKind(family, templateSource.value, toValue(parameters.granularity)),
  );
  const granularity = computed(() =>
    getGranularity(family, kind.value, toValue(parameters.granularity)),
  );
  const timeZone = computed(() => {
    const source = templateSource.value;
    return (
      toValue(parameters.timeZone) ??
      (source && isKind(source, 'zonedDateTime') ? source.timeZoneId : undefined)
    );
  });
  // With no value, the kind of the value that the field makes picks the calendar. A year and month
  // shows only in a calendar that has its months, so the field does not change its calendar when it
  // gets a value.
  const displayCal = computed(() =>
    displayCalendar(
      toValue(parameters.calendar),
      templateSource.value ?? (kind.value === 'yearMonth' ? getTemplate() : undefined),
      locale.value,
    ),
  );
  const midnight = computed(() => today(timeZone.value).toPlainDateTime());

  // The era of the date that the field shows. A field shows its era when it is not the era of the
  // reference date. A Gregorian date before the year 1 then has an era segment, and a date of
  // today has none.
  const referenceEra = computed(() => {
    const reference = toValue(parameters.referenceDate) ?? midnight.value;
    return isKind(reference, 'time')
      ? undefined
      : toPlainDate(reference).withCalendar(displayCal.value).era;
  });
  const draft = shallowRef<SegmentNumbers | null>(null);
  const currentEra = computed(() => {
    const current = value.value;
    if (current === null) {
      return draft.value?.era;
    }
    return isKind(current, 'time')
      ? undefined
      : toPlainDate(current).withCalendar(displayCal.value).era;
  });

  const layoutOptions = computed<SegmentLayoutOptions>(() => {
    const unit = granularity.value;
    const time = isTimeUnit(unit) ? unit : undefined;
    return {
      date: family === 'date' ? (unit === 'month' ? 'month' : 'day') : undefined,
      time,
      hourCycle: toValue(parameters.hourCycle),
      calendar: displayCal.value,
      era: currentEra.value !== undefined && currentEra.value !== referenceEra.value,
      timeZoneName:
        time !== undefined &&
        kind.value === 'zonedDateTime' &&
        !(toValue(parameters.hideTimeZone) ?? false),
    };
  });
  const layout = computed(() => getSegmentLayout(locale.value, layoutOptions.value));
  const hourCycle = computed(() => layout.value.hourCycle);
  const editableTypes = computed(() =>
    layout.value.segments.flatMap(({ type }) =>
      type === 'literal' || type === 'era' || type === 'timeZoneName' ? [] : [type],
    ),
  );
  const numbersContext = computed<NumbersContext>(() => ({
    calendar: displayCal.value,
    hourCycle: hourCycle.value,
    hasDate: layoutOptions.value.date !== undefined,
    hasTime: layoutOptions.value.time !== undefined,
  }));

  const numbers = computed<SegmentNumbers>(() =>
    value.value === null
      ? (draft.value ?? {})
      : toNumbers(value.value, displayCal.value, hourCycle.value),
  );
  // The numbers of an empty segment come from the reference date. Today at midnight gives the
  // numbers that the reference date lacks.
  const referenceNumbers = computed<SegmentNumbers>(() => {
    const reference = toValue(parameters.referenceDate);
    return {
      ...toNumbers(midnight.value, displayCal.value, hourCycle.value),
      ...(reference && toNumbers(reference, displayCal.value, hourCycle.value)),
    };
  });
  const hasDraft = computed(
    () =>
      value.value === null &&
      draft.value !== null &&
      editableTypes.value.some((type) => draft.value?.[type] !== undefined),
  );

  function getTemplate(): TemporalValue {
    const source = templateSource.value;
    if (source) {
      return source;
    }
    if (kind.value === 'yearMonth') {
      const date = midnight.value.toPlainDate();
      const isoMonth = date.toPlainYearMonth();
      const calendar = toValue(parameters.calendar);
      // An ISO year and month does not show in a calendar that has other months, so
      // `displayCalendar` ignores such a `calendar` prop for an ISO template. The template is thus
      // in that calendar.
      return calendar === undefined || yearMonthInCalendar(isoMonth, calendar)
        ? isoMonth
        : date.withCalendar(calendar).toPlainYearMonth();
    }
    if (kind.value === 'date') {
      return midnight.value.toPlainDate();
    }
    return kind.value === 'time' ? midnight.value.toPlainTime() : midnight.value;
  }

  const numberFormats = computed(
    () =>
      [
        new Intl.NumberFormat(locale.value, { useGrouping: false }),
        new Intl.NumberFormat(locale.value, { useGrouping: false, minimumIntegerDigits: 2 }),
      ] as const,
  );
  const displayNames = computed(
    () => new Intl.DisplayNames(locale.value, { type: 'dateTimeField' }),
  );
  const digits = computed(() => getDigits(locale.value));
  const dayPeriodTexts = computed(() => getDayPeriodTexts(locale.value));

  const rootElement = shallowRef<HTMLElement | null>(null);

  const controlId = useLabelableId({
    id: () => toValue(parameters.id),
    element: () => firstSegment.value,
  });

  // The name of a month depends on its year in a calendar with leap months. The value can have
  // another calendar than the field, so the date goes into the calendar of the field first.
  function getMonthName(month: number): string {
    const date = fromNumbers({ ...numbers.value, month, day: 1 }, getTemplate(), {
      ...numbersContext.value,
      hasDate: true,
      hasTime: false,
    });
    const [format, epoch] = formatter(
      isKind(date, 'time') ? date : toPlainDate(date).withCalendar(displayCal.value),
      { month: 'long' },
      locale.value,
    );
    return format.format(epoch);
  }

  const views = computed(() => {
    const current = numbers.value;
    const limits = getLimits(current, referenceNumbers.value, displayCal.value);
    const forceLeadingZeros = toValue(parameters.forceLeadingZeros) ?? false;
    const result: Partial<Record<EditableSegmentType, DateTimeFieldSegmentView>> = {};
    editableTypes.value.forEach((type, ordinal) => {
      const label = displayNames.value.of(type) ?? type;
      const id = ordinal === 0 ? controlId.value : `${controlId.value}-${ordinal + 1}`;
      if (!isNumericType(type)) {
        const texts = dayPeriodTexts.value;
        const period = current.dayPeriod;
        const text = period === undefined ? '' : texts[period];
        result[type] = {
          number: period === undefined ? undefined : period === 'am' ? 0 : 1,
          text,
          placeholder: PLACEHOLDERS[type],
          min: 0,
          max: 1,
          valueText: period === undefined ? EMPTY_TEXT : text,
          label,
          size: Math.max(texts.am.length, texts.pm.length, PLACEHOLDERS[type].length),
          id,
        };
        return;
      }
      const range = getRange(type, limits, hourCycle.value);
      const number = current[type];
      const padding = getPadding(type, hourCycle.value, forceLeadingZeros);
      let valueText: string | undefined;
      if (number === undefined) {
        valueText = EMPTY_TEXT;
      } else if (type === 'month') {
        valueText = getMonthName(number);
      }
      result[type] = {
        number,
        text: number === undefined ? '' : numberFormats.value[padding > 1 ? 1 : 0].format(number),
        placeholder: PLACEHOLDERS[type],
        min: range.min,
        max: range.max,
        valueText,
        label,
        size: type === 'year' ? 4 : 2,
        id,
      };
    });
    return result;
  });

  // A value with an era or a time zone name has the text of it for the segment. A field with no
  // value shows them for the numbers that it has.
  const hasFixedText = computed(() =>
    layout.value.segments.some(({ type }) => type === 'era' || type === 'timeZoneName'),
  );
  const segments = computed<DateTimeFieldSegment[]>(() => {
    const texts = hasFixedText.value
      ? getFixedSegmentTexts(
          value.value ?? fromNumbers(numbers.value, getTemplate(), numbersContext.value),
          locale.value,
          layout.value,
          displayCal.value,
        )
      : { era: '', timeZoneName: '' };
    return layout.value.segments.map((segment, index): DateTimeFieldSegment => {
      if (segment.type === 'literal') {
        return { type: 'literal', index, editable: false, text: segment.text };
      }
      if (segment.type === 'era' || segment.type === 'timeZoneName') {
        return { type: segment.type, index, editable: false, text: texts[segment.type] };
      }
      return { type: segment.type, index, editable: true };
    });
  });

  // A change of the value, in the order of the events of the part.
  function setValue(next: Value | null, details: DateTimeFieldChangeEventDetails): boolean {
    if (isSameValue(next, value.value)) {
      return false;
    }
    valueChange(next, details);
    if (details.isCanceled) {
      return false;
    }
    updateValue(next);
    value.value = next;
    return true;
  }

  function applyNumbers(next: SegmentNumbers, details: DateTimeFieldChangeEventDetails) {
    const isComplete = editableTypes.value.every((type) => next[type] !== undefined);
    const isEmpty = editableTypes.value.every((type) => next[type] === undefined);
    if (isComplete) {
      draft.value = null;
      // The kind of `Value` follows the kind of its template, which `getTemplate` gives. With no
      // template, the value is the kind that the granularity gives.
      setValue(fromNumbers(next, getTemplate(), numbersContext.value) as Value, details);
      return;
    }
    // A field that is not complete has no value. A controlled value that the parent keeps shows
    // again, because the value wins over the draft.
    draft.value = isEmpty ? null : next;
    setValue(null, details);
  }

  function patchNumbers(patch: SegmentNumbers, details: DateTimeFieldChangeEventDetails) {
    applyNumbers({ ...numbers.value, ...patch }, details);
  }

  function setNumber(
    type: NumericSegmentType,
    number: number | undefined,
    details: DateTimeFieldChangeEventDetails,
  ) {
    const next = { ...numbers.value };
    next[type] = number;
    if (type === 'year') {
      next.era ??= referenceNumbers.value.era;
    }
    applyNumbers(next, details);
  }

  function setDayPeriod(
    dayPeriod: DayPeriod | undefined,
    details: DateTimeFieldChangeEventDetails,
  ) {
    patchNumbers({ dayPeriod }, details);
  }

  function spin(
    type: EditableSegmentType,
    action: SegmentSpin,
    details: DateTimeFieldChangeEventDetails,
  ) {
    const current = numbers.value;
    const reference = referenceNumbers.value;
    if (!isNumericType(type)) {
      let next: DayPeriod | undefined;
      if (action === 'min' || action === 'max') {
        next = action === 'min' ? 'am' : 'pm';
      } else if (current.dayPeriod === undefined) {
        next = reference.dayPeriod;
      } else {
        next = current.dayPeriod === 'am' ? 'pm' : 'am';
      }
      patchNumbers({ dayPeriod: next }, details);
      return;
    }
    const shown = current[type];
    if (type === 'year' && typeof action === 'number' && shown !== undefined) {
      patchNumbers(shiftYear(current, action, displayCal.value), details);
      return;
    }
    const range = getRange(type, getLimits(current, reference, displayCal.value), hourCycle.value);
    let next: number;
    if (action === 'min') {
      next = range.min;
    } else if (action === 'max') {
      next = range.max;
    } else if (shown === undefined) {
      next = clamp(reference[type] ?? range.min, range.min, range.max);
    } else {
      next = wrapNumber(shown + action, range);
    }
    setNumber(type, next, details);
  }

  // A number outside the range of its segment means that the text has another layout, such as
  // `2027/05/17` for the layout month, day, year.
  function isInRanges(next: SegmentNumbers): boolean {
    const types = editableTypes.value.filter(isNumericType);
    const isInRange = (type: NumericSegmentType, limits: Limits) => {
      const number = next[type];
      const { min, max } = getRange(type, limits, hourCycle.value);
      return number !== undefined && number >= min && number <= max;
    };
    // The range of a year reads no limits. The limits of the month and the day need a year that
    // `Temporal` can make, so the year comes first.
    if (types.includes('year') && !isInRange('year', { monthsInYear: 12, daysInMonth: 31 })) {
      return false;
    }
    const limits = getLimits(next, referenceNumbers.value, displayCal.value);
    return types.every((type) => isInRange(type, limits));
  }

  // A date with a different kind gives its numbers too: the segments of the layout use theirs.
  function parseText(text: string, isPaste: boolean): SegmentNumbers | undefined {
    const kinds: TemporalKind[] =
      kind.value === 'zonedDateTime' ? ['zonedDateTime', 'dateTime'] : [kind.value];
    for (const textKind of kinds) {
      const parsed = parseInputText(text, textKind);
      if (parsed) {
        return toNumbers(parsed, displayCal.value, hourCycle.value);
      }
    }
    if (!isPaste) {
      return undefined;
    }
    const parsed = parseLocaleText(text, editableTypes.value, digits.value, dayPeriodTexts.value);
    return parsed && isInRanges(parsed) ? parsed : undefined;
  }

  function pasteText(text: string, event: ClipboardEvent) {
    const parsed = parseText(text.trim(), true);
    if (parsed) {
      applyNumbers(parsed, createChangeEventDetails(REASONS.inputPaste, event));
    }
  }

  // The segments in the order of the document, because a part can render them in a wrapper.
  const segmentElements = shallowReactive(new Map<HTMLInputElement, () => EditableSegmentType>());
  function getOrderedSegments(connectedOnly = false) {
    return [...segmentElements.keys()]
      .filter((element) => !connectedOnly || element.isConnected)
      .sort((a, b) =>
        a.compareDocumentPosition(b) & ownerWindow(a).Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
  }
  const firstSegment = computed(() => getOrderedSegments()[0] ?? null);

  function focusSegment(element: HTMLInputElement | undefined) {
    element?.focus();
    element?.select();
  }

  function moveFocus(from: HTMLInputElement, direction: 1 | -1) {
    const ordered = getOrderedSegments(true);
    focusSegment(ordered[ordered.indexOf(from) + direction]);
  }

  function handleInputPress(event: MouseEvent) {
    if (event.defaultPrevented || isDisabled.value) {
      return;
    }
    event.preventDefault();
    const ordered = getOrderedSegments(true);
    const emptyType = editableTypes.value.find((type) => numbers.value[type] === undefined);
    focusSegment(
      ordered.find((element) => segmentElements.get(element)?.() === emptyType) ?? ordered[0],
    );
  }

  const focused = shallowRef(false);

  // The root handles the focus that leaves it, because an element in the root that is not a
  // segment, such as a clear button, can have the focus last. A move inside the root keeps the field
  // focused.
  function handleFocusout(event: FocusEvent) {
    if (!focused.value || contains(rootElement.value, event.relatedTarget as Element | null)) {
      return;
    }
    setTouched(true);
    focused.value = false;
    setFieldFocused(false);
    if (validationMode.value === 'onBlur') {
      syncCustomValidity();
      void validation.commit(value.value);
    }
  }

  const ariaAfterHydration = useAriaAfterHydration();
  const ariaLabelledBy = useAriaLabelledBy(
    () => toValue(parameters.ariaLabelledby),
    useControlLabelId(),
    firstSegment,
    true,
    controlId,
  );

  const filled = computed(() => value.value !== null);
  watch(filled, setFilled, { immediate: true });

  const { name: inputName } = useFieldControl(firstSegment, {
    id: controlId,
    name: () => toValue(parameters.name),
    value,
    enabled: () => !isDisabled.value,
  });
  const clearFieldError = useClearFieldError(inputName);

  // A field that shows no time compares days, because the user cannot change the time of its
  // value. A limit then loses its time.
  const limits = computed<ValueLimits>(() => {
    const limitOf = (limit: DateValue | undefined) =>
      limit && !isTimeUnit(granularity.value) ? toPlainDate(limit) : limit;
    return {
      minDate: limitOf(toValue(parameters.minDate)),
      maxDate: limitOf(toValue(parameters.maxDate)),
      minTime: toValue(parameters.minTime),
      maxTime: toValue(parameters.maxTime),
      unavailableDates: toValue(parameters.unavailableDates),
    };
  });
  // The hidden input checks the limits that its type has. The others, and the partial entry, are
  // a custom error of the input.
  const customMessage = computed(() => {
    if (hasDraft.value) {
      return PARTIAL_MESSAGE;
    }
    return value.value === null
      ? ''
      : getLimitMessage(value.value, limits.value, locale.value, displayCal.value);
  });

  const writesHiddenValue = useHiddenValueBeforeHydration(() => hiddenInputElement.value);

  function syncCustomValidity() {
    hiddenInputElement.value?.setCustomValidity(customMessage.value);
  }

  // The key of the validity of the field. It changes with the value and with a partial entry, and
  // it is a text, because a parent can make an equal value of a new object in each render.
  const validityKey = computed(() => {
    const text = value.value === null ? '' : value.value.toString();
    const entry = hasDraft.value ? editableTypes.value.map((type) => draft.value?.[type]) : [];
    return `${text}|${entry.join(',')}`;
  });

  // The change of a reset reaches `useValueChanged` after the reset timeout. The root clears the
  // error of the field in that callback, and the change starts no validation.
  let isResetChangePending = false;

  // The reset count marks the next value from the picker as a reset. This watcher runs before the
  // next render gives that value to the field, whichever reset listener runs first. A picker with
  // two fields counts each reset one time, so both fields get the mark.
  const pickerResetCount = inject(PickerResetCountContext, null);
  let keyBeforePickerReset = '';

  if (pickerResetCount) {
    watch(
      pickerResetCount,
      () => {
        keyBeforePickerReset = validityKey.value;
        isResetChangePending = true;
      },
      { flush: 'sync' },
    );
    // `useValueChanged` calls no callback for a reset that leaves the value, and a mark that stays
    // set skips the validation of the next change. The listener of the reset in this root clears
    // the error of such a reset. A root that is not in the form of the reset keeps its error.
    watch(
      pickerResetCount,
      () => {
        if (validityKey.value === keyBeforePickerReset) {
          isResetChangePending = false;
        }
      },
      { flush: 'post' },
    );
  }

  useValueChanged(validityKey, () => {
    clearErrors(inputName.value);
    setDirty(!isSameValue(value.value, validityData.value.initialValue));
    syncCustomValidity();
    if (isResetChangePending) {
      isResetChangePending = false;
      clearFieldError(value.value);
    } else {
      validation.change(value.value);
    }
  });

  // A non-null value shows its own numbers, so a draft that outlives it is stale.
  watchPostEffect(() => {
    if (value.value !== null && draft.value !== null) {
      draft.value = null;
    }
  });

  // The numbers of a draft belong to a calendar and to an hour cycle.
  watch([displayCal, hourCycle], () => {
    draft.value = null;
  });

  function clear(event?: MouseEvent | KeyboardEvent) {
    draft.value = null;
    setValue(
      null,
      event
        ? createChangeEventDetails(REASONS.clearPress, event)
        : createChangeEventDetails(REASONS.none),
    );
    if (event) {
      focusSegment(getOrderedSegments(true)[0]);
    }
  }

  const resetCount = shallowRef(0);

  useFormReset(hiddenInputElement, (event) => {
    const before = validityKey.value;
    draft.value = null;
    if (toValue(parameters.value) === undefined) {
      setValue(
        toValue(parameters.defaultValue) ?? null,
        createChangeEventDetails(REASONS.none, event),
      );
    }
    if (validityKey.value === before) {
      clearFieldError(value.value);
    } else {
      isResetChangePending = true;
    }
    // The browser reset the inputs before this call. The text of the input is not the text of the
    // model when the reset left the model as it was.
    renderValue();
    resetCount.value += 1;
  });

  const hiddenText = computed(() =>
    value.value === null ? '' : toInputText(value.value, granularity.value === 'second'),
  );
  const inputLimits = computed(() =>
    getInputLimits(kind.value, limits.value, granularity.value === 'second'),
  );

  const { valueProps, renderValue } = useFormRestoreAsInput(
    hiddenInputElement,
    () => hiddenText.value,
    false,
  );

  function handleHiddenInput(event: Event) {
    if (!event.defaultPrevented && !isDisabled.value && !isReadOnly.value) {
      const text = (event.currentTarget as HTMLInputElement).value;
      const details = createChangeEventDetails(REASONS.inputChange, event);
      const parsed = text === '' ? undefined : parseText(text, false);
      if (parsed) {
        applyNumbers(parsed, details);
      } else if (text === '') {
        draft.value = null;
        setValue(null, details);
      }
    }
    renderValue();
  }

  // A field can have more than one input, such as two date fields of a range. The input goes to the
  // registry of the field and not to `validation.inputRef`. The registry gives the field the first
  // invalid input in the document.
  useInputRegistration(hiddenInputElement, (input) =>
    validation.registerInput(input, {
      controlRef: () => firstSegment.value,
      get value() {
        return hiddenText.value;
      },
    }),
  );

  watchPostEffect(syncCustomValidity);

  function hiddenInputProps() {
    const type = INPUT_TYPES[kind.value] ?? 'text';
    const validationProps = validation.getValidationProps(isDisabled.value);
    return {
      ...validationProps,
      'aria-describedby': ariaAfterHydration(validationProps['aria-describedby']),
      type,
      id:
        controlId.value && inputName.value == null ? `${controlId.value}-hidden-input` : undefined,
      form: toValue(parameters.form),
      name: inputName.value,
      ...(writesHiddenValue.value ? valueProps() : undefined),
      autocomplete: toValue(parameters.autoComplete),
      min: inputLimits.value.min,
      max: inputLimits.value.max,
      step:
        type === 'text' || type === 'date'
          ? undefined
          : (toValue(parameters.step) ?? (granularity.value === 'second' ? 1 : undefined)),
      disabled: isDisabled.value,
      readonly: isReadOnly.value,
      required: isRequired.value,
      'aria-hidden': true,
      tabindex: -1,
      style: inputName.value ? visuallyHiddenInput : visuallyHiddenInputPinned,
      onInvalid: handleHiddenInputInvalid,
      onFocusin() {
        focusSegment(getOrderedSegments(true)[0]);
      },
      onInput: handleHiddenInput,
    };
  }

  const state = computed<DateTimeFieldRootState>(() => ({
    ...fieldState.value,
    disabled: isDisabled.value,
    filled: filled.value,
    focused: focused.value,
    readOnly: isReadOnly.value,
    required: isRequired.value,
    empty: value.value === null && !hasDraft.value,
    complete: value.value !== null,
    invalid: Boolean(fieldInvalid.value),
  }));

  function getRootProps(attrs: Record<string, any>): Record<string, any>[] {
    const { 'aria-describedby': ariaDescribedBy, ...elementAttrs } = attrs;
    return [
      {
        role: 'group',
        id: host?.groupId,
        'aria-describedby': getDescriptionProps({ 'aria-describedby': ariaDescribedBy })[
          'aria-describedby'
        ],
        'aria-labelledby': ariaLabelledBy.value,
        onFocusout: handleFocusout,
      },
      elementAttrs,
    ];
  }

  // `listKey` changes when the layout of the server differs from the first layout of the browser.
  // Vue reuses a server element of the same tag for another part, and it writes no attribute of a
  // `v-bind` object while it hydrates. The element then keeps the attributes of the server, such as
  // `data-type`, `aria-hidden` and `aria-valuemax`. A server can put a time zone name or an era in
  // the place of a separator, so the root also compares each literal part with its place in the
  // layout. New keys make the elements again. Vue changes the text of a literal itself.
  const listKey = shallowRef(0);
  const hydratedLayout = segments.value.map(({ type }) => type);
  const hydratedTypes = editableTypes.value;
  const hydratedAttributes = hydratedTypes.map((type) =>
    getSegmentAttributes(type, views.value[type] ?? EMPTY_VIEW),
  );
  const literalElements = new Map<HTMLElement, number>();
  onMounted(() => {
    const shown = getOrderedSegments();
    const isSame =
      [...literalElements].every(
        ([element, index]) => element.dataset.type === hydratedLayout[index],
      ) &&
      shown.length === hydratedTypes.length &&
      shown.every(
        (element, index) =>
          element.dataset.type === hydratedTypes[index] &&
          Object.entries(hydratedAttributes[index] ?? {}).every(
            ([name, expected]) =>
              element.getAttribute(name) === (expected === undefined ? null : String(expected)),
          ),
      );
    if (!isSame) {
      listKey.value += 1;
    }
  });

  const context: DateTimeFieldContext = {
    state,
    segments,
    listKey,
    resetCount,
    disabled: isDisabled,
    readOnly: isReadOnly,
    required: isRequired,
    invalid: computed(() => Boolean(fieldInvalid.value)),
    digits,
    dayPeriodTexts,
    getView: (type) => views.value[type] ?? EMPTY_VIEW,
    setNumber,
    setDayPeriod,
    spin,
    pasteText,
    moveFocus,
    registerSegment(element, getType) {
      segmentElements.set(element, getType);
      return () => {
        if (segmentElements.get(element) === getType) {
          segmentElements.delete(element);
        }
      };
    },
    registerLiteral: (element, index) => literalElements.set(element, index),
    unregisterLiteral: (element) => literalElements.delete(element),
    setFocused(next) {
      focused.value = next;
    },
    handleInputPress,
    setRootElement(element) {
      rootElement.value = element as HTMLElement | null;
    },
    hiddenInputElement,
    getRootProps,
    hiddenInputProps,
    clear,
  };

  provide(DateTimeFieldContext, context);

  return context;
}
