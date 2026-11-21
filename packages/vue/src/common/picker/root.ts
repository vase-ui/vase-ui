import { computed, inject, nextTick, onMounted, shallowReactive, shallowRef, watch } from 'vue';
import { fieldKey } from '../../field/control';
import { useInDisabledFieldset } from '../../fieldset/part';
import type { ChangeEventDetails } from '../changeEventDetails';
import { isKind } from '../date-time/temporal';
import { byDocumentOrder } from '../element';
import { useModel } from '../model';

/** What a picker root gives to its parts. The properties are reactive. */
export interface PickerForPart<Value, Template = Value> {
  /** `null` while the picker has no value. */
  readonly value: Value | null;
  /** The value that gives a new value its kind, calendar, zone, and the units that a part does not set. */
  readonly template: Template;
  /** `null` before the mount. */
  readonly today: Temporal.PlainDate | null;
  /** By the prop, a disabled `Field` or a disabled fieldset. */
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly closeOnSelect: boolean;
  readonly firstField: HTMLElement | undefined;
  readonly firstTrigger: HTMLElement | undefined;
  /**
   * A change of the user. The root emits `valueChange` with `details`, and then takes the value.
   * Returns `false` when a listener cancels the change.
   */
  commit(value: Value | null, details: ChangeEventDetails): boolean;
  /** Takes the value with `update:modelValue` only, as `clear()` of a field part. */
  set(value: Value | null): void;
  /**
   * A native reset of a form: the root takes the model of its mount, else its `defaultValue`, one
   * time for each event.
   */
  reset(event: Event): void;
  addField(element: HTMLElement): () => void;
  addTrigger(element: HTMLElement): () => void;
}

export interface PickerProps<Value> {
  modelValue?: Value | null | undefined;
  defaultValue?: Value | null | undefined;
  open?: boolean | undefined;
  closeOnSelect?: boolean | undefined;
  disabled?: boolean | undefined;
  readonly?: boolean | undefined;
  timeZone?: string | undefined;
}

// The day of the template before the mount. No user event comes before the mount, so no value
// gets it.
const FIXED_DAY = '1970-01-01';

/**
 * The value, the template, today and the state of a picker. The root of each family calls it in
 * `setup`, and adds the props that its parts share.
 */
export function usePicker<Value, Template = Value>(
  props: PickerProps<Value>,
  options: {
    emitChange(value: Value | null, details: ChangeEventDetails): void;
    emitModel(value: Value | null): void;
    /** The template that a value gives: the first end of a range that has a value. */
    templateOf?: (value: Value) => Template | null;
    same(a: Value | null, b: Value | null): boolean;
    /** The template of a picker that never had a value, from today. */
    fallback(today: Temporal.PlainDate): Template;
    /** `closeOnSelect` when the prop is absent. */
    closes(template: Template): boolean;
  },
) {
  const field = inject(fieldKey, null);
  const first = (props.modelValue !== undefined ? props.modelValue : props.defaultValue) ?? null;
  const model = useModel<Value | null>(() => props.modelValue, first);
  const value = model.value;
  const templateOf = options.templateOf ?? ((candidate: Value) => candidate as unknown as Template);
  const filled = (candidate: Value | null | undefined) =>
    candidate == null ? undefined : (templateOf(candidate) ?? undefined);
  // A value that becomes empty keeps its kind for the next value.
  const lastValue = shallowRef(filled(first));
  watch(value, (next) => (lastValue.value = filled(next) ?? lastValue.value));

  const today = shallowRef<Temporal.PlainDate | null>(null);
  const template = computed(
    () =>
      filled(value.value) ??
      filled(props.defaultValue) ??
      lastValue.value ??
      options.fallback(today.value ?? Temporal.PlainDate.from(FIXED_DAY)),
  );
  function readClock() {
    const current = template.value;
    const zone = isKind(current, 'zonedDateTime') ? current.timeZoneId : undefined;
    today.value = Temporal.Now.plainDateISO(props.timeZone ?? zone);
  }
  onMounted(readClock);
  // A parent that writes `true` opens the popup with no `update:open` of `Popover.Root`.
  watch(
    () => props.open,
    (open) => {
      if (open) readClock();
    },
  );

  const fields = shallowReactive<HTMLElement[]>([]);
  const triggers = shallowReactive<HTMLElement[]>([]);
  const firstOf = (list: HTMLElement[]) => [...list].sort(byDocumentOrder)[0];
  const firstField = computed(() => firstOf(fields));
  const firstTrigger = computed(() => firstOf(triggers));
  const inDisabledFieldset = useInDisabledFieldset(() => firstField.value ?? firstTrigger.value);
  const disabled = computed(
    () => !!props.disabled || !!field?.disabled || inDisabledFieldset.value,
  );
  const add = (list: HTMLElement[], element: HTMLElement) => {
    list.push(element);
    return () => list.splice(list.indexOf(element), 1);
  };

  let lastReset: Event | undefined;

  function commit(next: Value | null, details: ChangeEventDetails) {
    // A listener of the developer on the part cancelled the change.
    if (details.isCanceled) return false;
    options.emitChange(next, details);
    if (details.isCanceled) return false;
    model.setOwn(next);
    options.emitModel(next);
    // A controlled parent answers in its next render. A field root also calls `onEdit` for its own
    // change, and a second call changes nothing.
    if (field) void nextTick(() => field.onEdit());
    return true;
  }

  function set(next: Value | null) {
    if (options.same(next, value.value)) return;
    model.setOwn(next);
    options.emitModel(next);
  }

  const picker = {
    get value() {
      return value.value;
    },
    get template() {
      return template.value;
    },
    get today() {
      return today.value;
    },
    get disabled() {
      return disabled.value;
    },
    get readonly() {
      return !!props.readonly;
    },
    get closeOnSelect() {
      return props.closeOnSelect ?? options.closes(template.value);
    },
    get firstField() {
      return firstField.value;
    },
    get firstTrigger() {
      return firstTrigger.value;
    },
    commit,
    set,
    reset(event: Event) {
      // The two fields of a range call it for one reset. A controlled value changes only at the
      // next render, so a second call would emit again.
      if (event === lastReset) return;
      lastReset = event;
      const reset = model.resetValue(props.defaultValue ?? null);
      field?.onReset(reset);
      set(reset);
    },
    addField: (element: HTMLElement) => add(fields, element),
    addTrigger: (element: HTMLElement) => add(triggers, element),
  } satisfies PickerForPart<Value, Template>;

  return {
    picker,
    field,
    /** Reads today again. A root calls it at each `update:open` with `true`. */
    readClock,
  };
}

/** One object with the properties of `a` and of `b`. A getter stays a getter, so it stays reactive. */
export function mergeGetters<A extends object, B extends object>(a: A, b: B): A & B {
  return Object.defineProperties(
    {},
    { ...Object.getOwnPropertyDescriptors(a), ...Object.getOwnPropertyDescriptors(b) },
  ) as A & B;
}
