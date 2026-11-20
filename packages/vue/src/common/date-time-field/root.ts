import {
  computed,
  inject,
  mergeProps,
  nextTick,
  provide,
  shallowReactive,
  shallowRef,
  useId,
  watch,
  type Ref,
} from 'vue';
import { describedByWith, fieldKey } from '../../field/control';
import { useInDisabledFieldset } from '../../fieldset/part';
import { displayCalendar } from '../../internals/date-time/displayCalendar';
import { digits as localeDigits, formatter } from '../../internals/date-time/format';
import { matches, type DateMatcher } from '../../internals/date-time/matchers';
import {
  isKind,
  kindOf,
  parseInputText,
  toInputText,
  toPlainDate,
  toPlainTime,
  today,
  yearMonthInCalendar,
  type DateValue,
  type TemporalKind,
  type TemporalValue,
  type TimeValue,
} from '../../internals/date-time/temporal';
import { useLocale } from '../../locale-provider/part';
import { createChangeEventDetails } from '../changeEventDetails';
import { useDeferredServerRender } from '../deferredServerRender';
import { byDocumentOrder } from '../element';
import { useFormReset } from '../formEvents';
import { givenId } from '../id';
import { useModel } from '../model';
import { visuallyHiddenInput } from '../visuallyHidden';
import {
  dateTimeFieldHostKey,
  dateTimeFieldKey,
  stateAttributes,
  type DateTimeFieldChangeEventDetails,
  type DateTimeFieldGranularity,
  type DateTimeFieldSegment,
  type DateTimeFieldState,
  type SegmentSpin,
  type SegmentView,
} from './field';
import {
  fromNumbers,
  getDayPeriodTexts,
  getFixedSegmentTexts,
  getLimits,
  getPadding,
  getRange,
  getSegmentLayout,
  isNumericType,
  parseLocaleText,
  shiftYear,
  toNumbers,
  wrapNumber,
  type DayPeriod,
  type EditableSegmentType,
  type NumbersContext,
  type NumericSegmentType,
  type SegmentLayoutOptions,
  type SegmentNumbers,
  type TimeUnit,
} from './layout';
import { getInputLimits, nativeFailure, type DateTimeFieldError } from './limits';

/** The props that the roots of `DateField` and `TimeField` share. */
export interface DateTimeFieldRootOptions {
  modelValue?: TemporalValue | null | undefined;
  defaultValue?: TemporalValue | null | undefined;
  referenceDate?: TemporalValue | undefined;
  granularity?: DateTimeFieldGranularity | undefined;
  hourCycle?: 12 | 24 | undefined;
  forceLeadingZeros?: boolean | undefined;
  hideTimeZone?: boolean | undefined;
  locale?: Intl.LocalesArgument | undefined;
  calendar?: string | undefined;
  timeZone?: string | undefined;
  unavailableDates?: DateMatcher | undefined;
  min?: DateValue | Temporal.PlainTime | undefined;
  max?: DateValue | Temporal.PlainTime | undefined;
  step?: number | undefined;
  id?: string | undefined;
  name?: string | undefined;
  form?: string | undefined;
  autocomplete?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  readonly?: boolean | undefined;
}

const INPUT_TYPES: Partial<Record<TemporalKind, string>> = {
  date: 'date',
  dateTime: 'datetime-local',
  time: 'time',
};

const TIME_UNITS: readonly DateTimeFieldGranularity[] = ['hour', 'minute', 'second'];
const DATE_UNITS: readonly EditableSegmentType[] = ['year', 'month', 'day'];

// The day of each render that would read today: the numbers of a value with no template, and the
// era that a value shows. A render never reads the clock or the zone of the runtime, so the server
// and the browser write the same HTML.
const FIXED_DAY = '2000-01-01T00:00';

function isTimeUnit(granularity: DateTimeFieldGranularity): granularity is TimeUnit {
  return TIME_UNITS.includes(granularity);
}

/** Two values of the same kind and the same `equals`, or two empty values. */
export function sameTemporal(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  const kind = kindOf(a);
  return kind !== null && kind === kindOf(b) && (a as Temporal.PlainDate).equals(b as never);
}

function kindOfField(
  family: 'date' | 'time',
  source: TemporalValue | undefined,
  granularity: DateTimeFieldGranularity | undefined,
): TemporalKind {
  const sourceKind = source && kindOf(source);
  if (sourceKind) return sourceKind;
  if (family === 'time') return 'time';
  if (granularity === 'month') return 'yearMonth';
  return granularity === undefined || granularity === 'day' ? 'date' : 'dateTime';
}

// The granularity that the kind allows. A value of another kind keeps its own kind.
function granularityOfField(
  family: 'date' | 'time',
  kind: TemporalKind,
  requested: DateTimeFieldGranularity | undefined,
): DateTimeFieldGranularity {
  if (family === 'time' || kind === 'time') {
    return requested && isTimeUnit(requested) ? requested : 'minute';
  }
  if (kind === 'yearMonth') return 'month';
  if (kind === 'date') return requested === 'month' ? 'month' : 'day';
  return requested ?? 'minute';
}

/**
 * The value, the segments, the form input and the validity of a date field or a time field. The
 * root part calls it in `setup` and gives its result to its template. It provides the contract of
 * `field.ts` to the other parts.
 */
export function useDateTimeFieldRoot<Value extends TemporalValue>(options: {
  family: 'date' | 'time';
  props: DateTimeFieldRootOptions;
  element: Readonly<Ref<HTMLElement | null>>;
  inputElement: Readonly<Ref<HTMLInputElement | null>>;
  emitChange(value: Value | null, details: DateTimeFieldChangeEventDetails): void;
  emitModel(value: Value | null): void;
}) {
  const { family, props, inputElement } = options;
  const field = inject(fieldKey, null);
  const host = inject(dateTimeFieldHostKey, null);
  // The label and the messages of the field can come after the root.
  useDeferredServerRender();
  const generatedId = useId();
  const locale = useLocale(() => props.locale);
  const inDisabledFieldset = useInDisabledFieldset(options.element);
  const disabled = computed(
    () => !!field?.disabled || !!props.disabled || inDisabledFieldset.value,
  );
  const id = computed(() => givenId(props.id) ?? field?.controlId ?? generatedId);

  // A native reset gives the first value: the model of the mount, else `defaultValue`.
  const firstValue = (
    props.modelValue === undefined ? (props.defaultValue ?? null) : props.modelValue
  ) as Value | null;
  const { value, setOwn } = useModel<Value | null>(
    () => props.modelValue as Value | null | undefined,
    firstValue,
  );
  // The numbers of a partial entry. The field has no value until each segment has a number.
  const draft = shallowRef<SegmentNumbers | null>(null);

  // The value that gives the kind, the time and the zone of a new value.
  const templateSource = computed<TemporalValue | undefined>(
    () => value.value ?? props.defaultValue ?? props.referenceDate,
  );
  const kind = computed(() => kindOfField(family, templateSource.value, props.granularity));
  const granularity = computed(() => granularityOfField(family, kind.value, props.granularity));
  const showSeconds = computed(() => granularity.value === 'second');
  const fixedDay = () => Temporal.PlainDateTime.from(FIXED_DAY);

  // A new value with no template: the hidden units are those of midnight.
  function template(): TemporalValue {
    const source = templateSource.value;
    if (source) return source;
    const day = fixedDay();
    if (kind.value === 'yearMonth') {
      const month = day.toPlainDate().toPlainYearMonth();
      const calendar = props.calendar;
      // An ISO month does not show in a calendar that has other months, so the template is in
      // that calendar.
      return calendar === undefined || yearMonthInCalendar(month, calendar)
        ? month
        : day.toPlainDate().withCalendar(calendar).toPlainYearMonth();
    }
    if (kind.value === 'date') return day.toPlainDate();
    return kind.value === 'time' ? day.toPlainTime() : day;
  }

  // A year and month shows only in a calendar that has its months, so the field keeps its calendar
  // when it gets a value.
  const calendar = computed(() =>
    displayCalendar(
      props.calendar,
      templateSource.value ?? (kind.value === 'yearMonth' ? template() : undefined),
      locale.value,
    ),
  );
  const eraOf = (source: TemporalValue) =>
    isKind(source, 'time') ? undefined : toPlainDate(source).withCalendar(calendar.value).era;
  // A field shows the era of its date when it is not the era of the reference date. A Gregorian
  // date before the year 1 then has an era segment.
  const referenceEra = computed(() => eraOf(props.referenceDate ?? fixedDay()));
  const shownEra = computed(() =>
    value.value === null ? draft.value?.era : eraOf(value.value),
  );

  const layoutOptions = computed<SegmentLayoutOptions>(() => {
    const unit = granularity.value;
    const time = isTimeUnit(unit) ? unit : undefined;
    return {
      date: family === 'date' ? (unit === 'month' ? 'month' : 'day') : undefined,
      time,
      hourCycle: props.hourCycle,
      calendar: calendar.value,
      era: shownEra.value !== undefined && shownEra.value !== referenceEra.value,
      timeZoneName: time !== undefined && kind.value === 'zonedDateTime' && !props.hideTimeZone,
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
    calendar: calendar.value,
    hourCycle: hourCycle.value,
    hasDate: layoutOptions.value.date !== undefined,
    hasTime: layoutOptions.value.time !== undefined,
  }));
  const numbers = computed<SegmentNumbers>(() =>
    value.value === null
      ? (draft.value ?? {})
      : toNumbers(value.value, calendar.value, hourCycle.value),
  );
  const hasDraft = computed(
    () =>
      value.value === null &&
      editableTypes.value.some((type) => draft.value?.[type] !== undefined),
  );

  // The numbers of an empty segment at an arrow key, and the era of a typed year: those of
  // `referenceDate`, else of today at midnight. Only a key reads today.
  function referenceNumbers(): SegmentNumbers {
    const source = templateSource.value;
    const zone =
      props.timeZone ?? (isKind(source, 'zonedDateTime') ? source.timeZoneId : undefined);
    const reference = props.referenceDate;
    return {
      ...toNumbers(today(zone).toPlainDateTime(), calendar.value, hourCycle.value),
      ...(reference && toNumbers(reference, calendar.value, hourCycle.value)),
    };
  }

  const formats = computed(() => ({
    number: new Intl.NumberFormat(locale.value, { useGrouping: false }),
    padded: new Intl.NumberFormat(locale.value, { useGrouping: false, minimumIntegerDigits: 2 }),
    names: new Intl.DisplayNames(locale.value, { type: 'dateTimeField' }),
    narrowNames: new Intl.DisplayNames(locale.value, { type: 'dateTimeField', style: 'narrow' }),
  }));
  const digits = computed(() => localeDigits(locale.value));
  const dayPeriodTexts = computed(() => getDayPeriodTexts(locale.value));

  // The name of a month depends on its year in a calendar with leap months.
  function monthName(month: number): string {
    const date = fromNumbers({ ...numbers.value, month, day: 1 }, template(), {
      ...numbersContext.value,
      hasDate: true,
      hasTime: false,
    });
    const [format, epoch] = formatter(
      isKind(date, 'time') ? date : toPlainDate(date).withCalendar(calendar.value),
      { month: 'long' },
      locale.value,
    );
    return format.format(epoch);
  }

  const views = computed(() => {
    const current = numbers.value;
    const limits = getLimits(current, calendar.value);
    const { names, narrowNames, number: plain, padded } = formats.value;
    const result: Partial<Record<EditableSegmentType, SegmentView>> = {};
    for (const type of editableTypes.value) {
      const label = names.of(type) ?? type;
      if (!isNumericType(type)) {
        const texts = dayPeriodTexts.value;
        const period = current.dayPeriod;
        const text = period === undefined ? '' : texts[period];
        result[type] = {
          number: period === undefined ? undefined : period === 'am' ? 0 : 1,
          text,
          placeholder: '--',
          min: 0,
          max: 1,
          valueText: period === undefined ? undefined : text,
          label,
          size: Math.max(texts.am.length, texts.pm.length, 2),
        };
        continue;
      }
      const range = getRange(type, limits, hourCycle.value);
      const number = current[type];
      const padding = getPadding(type, hourCycle.value, !!props.forceLeadingZeros);
      // A time unit has one order, so `--` is enough. The order of a date differs by locale, so
      // each date unit shows its short name.
      const placeholder = DATE_UNITS.includes(type) ? (narrowNames.of(type) ?? type) : '--';
      result[type] = {
        number,
        text: number === undefined ? '' : (padding > 1 ? padded : plain).format(number),
        placeholder,
        min: range.min,
        max: range.max,
        valueText: number !== undefined && type === 'month' ? monthName(number) : undefined,
        label,
        size: Math.max(String(range.max).length, placeholder.length),
      };
    }
    return result;
  });

  // The era and the zone name of a field with no value come from the numbers that it has.
  const segments = computed<DateTimeFieldSegment[]>(() => {
    const hasFixedText = layout.value.segments.some(
      ({ type }) => type === 'era' || type === 'timeZoneName',
    );
    const texts = hasFixedText
      ? getFixedSegmentTexts(
          value.value ?? fromNumbers(numbers.value, template(), numbersContext.value),
          locale.value,
          layout.value,
          calendar.value,
        )
      : { era: '', timeZoneName: '' };
    return layout.value.segments.map(({ type, text }): DateTimeFieldSegment => {
      if (type === 'literal') return { type, editable: false, text };
      if (type === 'era' || type === 'timeZoneName') {
        return { type, editable: false, text: texts[type] };
      }
      return { type, editable: true };
    });
  });

  // The value wins over the numbers of a partial entry, so a draft that a value hides goes. The
  // numbers of a draft belong to a calendar and an hour cycle.
  watch(
    [value, draft],
    ([current]) => {
      if (current !== null) draft.value = null;
    },
    { flush: 'post' },
  );
  watch([calendar, hourCycle], () => (draft.value = null));

  function change(next: Value | null, details: DateTimeFieldChangeEventDetails): boolean {
    if (sameTemporal(next, value.value)) return true;
    options.emitChange(next, details);
    if (details.isCanceled) return false;
    setOwn(next);
    options.emitModel(next);
    // A controlled parent answers in its next render.
    nextTick(() => field?.onEdit());
    return true;
  }

  function applyNumbers(next: SegmentNumbers, details: DateTimeFieldChangeEventDetails) {
    const types = editableTypes.value;
    if (types.every((type) => next[type] !== undefined)) {
      const accepted = change(fromNumbers(next, template(), numbersContext.value) as Value, details);
      if (accepted) draft.value = null;
      return accepted;
    }
    const accepted = change(null, details);
    if (accepted) draft.value = types.some((type) => next[type] !== undefined) ? next : null;
    return accepted;
  }

  function setNumber(
    type: NumericSegmentType,
    number: number | undefined,
    details: DateTimeFieldChangeEventDetails,
  ) {
    const next = { ...numbers.value, [type]: number };
    if (type === 'year' && number !== undefined) next.era ??= referenceNumbers().era;
    return applyNumbers(next, details);
  }

  function spin(
    type: EditableSegmentType,
    action: SegmentSpin,
    details: DateTimeFieldChangeEventDetails,
  ) {
    const current = numbers.value;
    if (!isNumericType(type)) {
      let period: DayPeriod | undefined;
      if (action === 'min' || action === 'max') period = action === 'min' ? 'am' : 'pm';
      else if (current.dayPeriod === undefined) period = referenceNumbers().dayPeriod;
      else period = current.dayPeriod === 'am' ? 'pm' : 'am';
      applyNumbers({ ...current, dayPeriod: period }, details);
      return;
    }
    const shown = current[type];
    if (type === 'year' && typeof action === 'number' && shown !== undefined) {
      applyNumbers({ ...current, ...shiftYear(current, action, calendar.value) }, details);
      return;
    }
    const range = getRange(type, getLimits(current, calendar.value), hourCycle.value);
    let next: number;
    if (action === 'min') next = range.min;
    else if (action === 'max') next = range.max;
    else if (shown === undefined) {
      next = Math.min(Math.max(referenceNumbers()[type] ?? range.min, range.min), range.max);
    } else next = wrapNumber(shown + action, range);
    setNumber(type, next, details);
  }

  // A number outside the range of its segment means a text of another layout, such as
  // `2027/05/17` for the layout month, day, year.
  function isInRanges(next: SegmentNumbers): boolean {
    const types = editableTypes.value.filter(isNumericType);
    const inRange = (type: NumericSegmentType, limits: { monthsInYear: number; daysInMonth: number }) => {
      const number = next[type];
      const { min, max } = getRange(type, limits, hourCycle.value);
      return number !== undefined && number >= min && number <= max;
    };
    // The limits of the month and the day need a year that `Temporal` can make.
    if (types.includes('year') && !inRange('year', { monthsInYear: 12, daysInMonth: 31 })) {
      return false;
    }
    const limits = getLimits(next, calendar.value);
    return types.every((type) => inRange(type, limits));
  }

  // A text of a value of the kind, or for a paste a text in the layout of the locale.
  function parseText(text: string, inLayout: boolean): SegmentNumbers | undefined {
    const kinds: TemporalKind[] =
      kind.value === 'zonedDateTime' ? ['zonedDateTime', 'dateTime'] : [kind.value];
    for (const textKind of kinds) {
      const parsed = parseInputText(text, textKind);
      if (parsed) return toNumbers(parsed, calendar.value, hourCycle.value);
    }
    if (!inLayout) return undefined;
    const parsed = parseLocaleText(text, editableTypes.value, digits.value, dayPeriodTexts.value);
    return parsed && isInRanges(parsed) ? parsed : undefined;
  }

  const segmentElements = shallowReactive(new Map<HTMLInputElement, () => EditableSegmentType>());
  const orderedSegments = () =>
    [...segmentElements.keys()].filter((element) => element.isConnected).sort(byDocumentOrder);
  const firstSegment = computed(() => [...segmentElements.keys()].sort(byDocumentOrder)[0]);

  function focusSegment(element: HTMLInputElement | undefined) {
    element?.focus();
    element?.select();
  }

  function focusEmpty() {
    const ordered = orderedSegments();
    const emptyType = editableTypes.value.find((type) => numbers.value[type] === undefined);
    focusSegment(ordered.find((element) => segmentElements.get(element)?.() === emptyType) ?? ordered[0]);
  }

  const limitOf = (limit: DateValue | Temporal.PlainTime | undefined) =>
    // A field that shows no time compares days, so a limit with a time allows its own day.
    limit && !isKind(limit, 'time') && !isTimeUnit(granularity.value) ? toPlainDate(limit) : limit;

  // The checks that the type of the form input cannot make: a native input that is not in the
  // document makes them with the local value, as the field shows it.
  function failureOfLimits(document: Document, current: TemporalValue): DateTimeFieldError | null {
    const check = (type: string, text: string, limits: { min?: string; max?: string }) =>
      nativeFailure(document, { type, value: text, ...limits });
    if (family === 'time') {
      if (isKind(current, 'time')) return null;
      const step = props.step ?? (showSeconds.value ? 1 : undefined);
      return nativeFailure(document, {
        type: 'time',
        value: toInputText(toPlainTime(current as TimeValue), showSeconds.value),
        ...getInputLimits('time', props.min, props.max, showSeconds.value),
        step: step === undefined ? undefined : String(step),
      });
    }
    if (isKind(current, 'yearMonth')) {
      // A month is in the limits when one of its days is.
      const { min, max } = getInputLimits('date', limitOf(props.min), limitOf(props.max), false);
      const last = toInputText(current.toPlainDate({ day: current.daysInMonth }), false);
      const first = toInputText(current.toPlainDate({ day: 1 }), false);
      return check('date', last, { min }) ?? check('date', first, { max });
    }
    if (!isKind(current, 'zonedDateTime')) return null;
    // A zoned limit counts as its local time in the zone of the value.
    const local = (limit: DateValue | Temporal.PlainTime | undefined) =>
      limitOf(isKind(limit, 'zonedDateTime') ? limit.withTimeZone(current.timeZoneId) : limit);
    const showsTime = layoutOptions.value.time !== undefined;
    const shown = showsTime ? 'dateTime' : 'date';
    const limits = getInputLimits(shown, local(props.min), local(props.max), showSeconds.value);
    return nativeFailure(document, {
      type: showsTime ? 'datetime-local' : 'date',
      value: showsTime
        ? toInputText(current.toPlainDateTime(), showSeconds.value)
        : toInputText(current.toPlainDate(), false),
      ...limits,
      step: showsTime && showSeconds.value ? '1' : undefined,
    });
  }

  // A failure that the form input cannot find itself. The browser words each message.
  const ownError = computed<DateTimeFieldError | null>(() => {
    const document = inputElement.value?.ownerDocument;
    if (!document) return null;
    if (hasDraft.value) {
      // A native date input reports a partial entry as `badInput`.
      const missing = nativeFailure(document, { required: '' });
      return { flag: 'badInput', message: missing?.message ?? '' };
    }
    const current = value.value;
    if (current === null) return null;
    const failure = failureOfLimits(document, current);
    if (failure) return failure;
    const unavailable =
      props.unavailableDates &&
      !isKind(current, 'time') &&
      !isKind(current, 'yearMonth') &&
      matches(toPlainDate(current), props.unavailableDates);
    return unavailable ? nativeFailure(document, { pattern: 'a', value: 'b' }) : null;
  });
  watch(
    [inputElement, ownError],
    ([input, error]) => input?.setCustomValidity(error?.message ?? ''),
    { flush: 'post' },
  );

  watch(value, (next) => field?.setValue(next, next !== null), { immediate: true });
  watch(
    firstSegment,
    (segment, _, onCleanup) => {
      if (!segment || !field) return;
      onCleanup(
        field.setControl({
          // A `<label for>` names the first segment and gives it the focus.
          element: segment,
          focusElement: segment,
          get id() {
            return segment.id;
          },
          get name() {
            return props.name;
          },
          get disabled() {
            return !!props.disabled || inDisabledFieldset.value;
          },
          get readOnly() {
            return !!props.readonly;
          },
          get inputs() {
            return [inputElement.value, host?.endInput?.()].filter((input) => !!input);
          },
          get customError() {
            return ownError.value ?? undefined;
          },
          sameValue: sameTemporal,
        }),
      );
    },
    { flush: 'post' },
  );

  // A `<label>` names no segment, because each segment has an `aria-label`. The labels of the first
  // segment thus name the group. The server HTML has no such name. WebKit keeps the old `labels` of
  // an input whose `id` changes (test/measurements/date-time-field.test.ts), so the root looks for
  // the labels itself.
  const nativeLabelIds = shallowRef<string>();
  watch(
    [firstSegment, id],
    ([segment]) => {
      const scope = segment?.getRootNode() as Document | ShadowRoot | undefined;
      const candidates = [
        segment?.closest('label'),
        ...(scope?.querySelectorAll<HTMLLabelElement>('label[for]') ?? []),
      ];
      const labels = [...new Set(candidates)].filter(
        (label): label is HTMLLabelElement => !!segment && label?.control === segment,
      );
      labels.forEach((label, index) => {
        label.id ||= index === 0 ? `${id.value}-label` : `${id.value}-label-${index + 1}`;
      });
      nativeLabelIds.value = labels.map((label) => label.id).join(' ') || undefined;
    },
    { flush: 'post' },
  );

  useFormReset(inputElement, () => {
    draft.value = null;
    field?.onReset(firstValue);
    if (sameTemporal(value.value, firstValue)) return;
    setOwn(firstValue);
    options.emitModel(firstValue);
  });

  const state = computed<DateTimeFieldState>(() => ({
    empty: value.value === null && !hasDraft.value,
    complete: value.value !== null,
    disabled: disabled.value,
    readonly: !!props.readonly,
    required: !!props.required,
    touched: field?.state.touched ?? false,
    dirty: field?.state.dirty ?? false,
    valid: field?.state.valid ?? null,
    filled: field?.state.filled ?? false,
  }));

  provide(dateTimeFieldKey, {
    get state() {
      return state.value;
    },
    get segments() {
      return segments.value;
    },
    get id() {
      return id.value;
    },
    get invalid() {
      return state.value.valid === false;
    },
    get digits() {
      return digits.value;
    },
    get dayPeriodTexts() {
      return dayPeriodTexts.value;
    },
    view: (type) =>
      views.value[type] ?? {
        number: undefined,
        text: '',
        placeholder: '',
        min: 0,
        max: 0,
        valueText: undefined,
        label: '',
        size: 1,
      },
    setNumber,
    setDayPeriod: (dayPeriod, details) => applyNumbers({ ...numbers.value, dayPeriod }, details),
    spin,
    paste(text, event) {
      const parsed = parseText(text.trim(), true);
      if (parsed) applyNumbers(parsed, createChangeEventDetails('input-paste', event));
    },
    clear(event) {
      if (!value.value && !hasDraft.value) return;
      if (value.value && !change(null, createChangeEventDetails('clear-press', event))) return;
      draft.value = null;
      focusSegment(orderedSegments()[0]);
    },
    addSegment(element, type) {
      segmentElements.set(element, type);
      return () => {
        if (segmentElements.get(element) === type) segmentElements.delete(element);
      };
    },
    moveFocus(from, step) {
      const ordered = orderedSegments();
      focusSegment(ordered[ordered.indexOf(from) + step]);
    },
    focusEmpty,
  });

  function onFocusout(event: FocusEvent) {
    // A move of the focus inside the group, such as to `Clear`, is no leave.
    if (!options.element.value?.contains(event.relatedTarget as Node | null)) {
      field?.onLeave(event.target as Element);
    }
  }

  return {
    state,
    /** The attributes of the group element, with the attributes of the developer. */
    groupProps(attrs: Record<string, unknown>) {
      const { 'aria-describedby': describedBy, ...rest } = attrs;
      const named = 'aria-label' in attrs || 'aria-labelledby' in attrs;
      return mergeProps(
        {
          role: 'group',
          id: host?.groupId,
          'aria-labelledby': named ? undefined : (field?.labelId ?? nativeLabelIds.value),
          'aria-describedby': field ? describedByWith(field, describedBy) : describedBy,
          ...stateAttributes(state.value),
          onFocusout,
        },
        rest,
      );
    },
    /** The attributes of the form input. */
    inputProps() {
      const type = INPUT_TYPES[kind.value] ?? 'text';
      // The native input checks the limits of a value of its own kind only.
      const checksLimits = type !== 'text' && !(family === 'time' && type !== 'time');
      const limits = checksLimits
        ? getInputLimits(kind.value, limitOf(props.min), limitOf(props.max), showSeconds.value)
        : undefined;
      const step =
        type === 'time'
          ? (props.step ?? (showSeconds.value ? 1 : undefined))
          : type === 'datetime-local' && showSeconds.value
            ? 1
            : undefined;
      return {
        type,
        name: field?.name ?? props.name,
        form: props.form,
        autocomplete: props.autocomplete,
        value: value.value === null ? '' : toInputText(value.value, showSeconds.value),
        // Vue writes the `value` attribute, and the browser takes it as the step base of an input
        // with no `min` (test/measurements/date-time-field.test.ts). The step of a time goes from
        // midnight.
        min: limits?.min ?? (type === 'time' && step !== undefined ? '00:00' : undefined),
        max: limits?.max,
        step,
        required: !!props.required,
        disabled: disabled.value,
        readonly: !!props.readonly,
        'aria-hidden': true,
        tabindex: -1,
        style: visuallyHiddenInput,
        onInput,
        // A blocked submit gives the focus to the first invalid control.
        onFocus: () => focusSegment(orderedSegments()[0]),
      };
    },
    /** Empties each segment. `update:modelValue` follows when the field had a value. */
    clear() {
      draft.value = null;
      if (value.value === null) return;
      setOwn(null);
      options.emitModel(null);
    },
  };

  // A fill of the browser or of an extension writes a text of the type of the input.
  function onInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const text = input.value;
    if (!disabled.value && !props.readonly) {
      const details = createChangeEventDetails('input-change', event);
      if (text === '') {
        if (change(null, details)) draft.value = null;
      } else {
        const parsed = parseText(text, false);
        if (parsed) applyNumbers(parsed, details);
      }
    }
    // The input shows the value of the field again, also after a value that the parent refused.
    nextTick(() => {
      const shown = value.value === null ? '' : toInputText(value.value, showSeconds.value);
      if (input.value !== shown) input.value = shown;
    });
  }
}
