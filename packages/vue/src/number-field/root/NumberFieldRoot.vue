<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import { REASONS } from '../../internals/reasons';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ChangeEventCustomProperties } from '../utils/types';

export interface NumberFieldRootState extends FieldRootState {
  /**
   * The raw numeric value of the field.
   */
  value: number | null;
  /**
   * The formatted string value presented in the input element.
   */
  inputValue: string;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: boolean;
  /**
   * Whether the user is currently scrubbing the field.
   */
  scrubbing: boolean;
}

export interface NumberFieldRootProps
  extends
    VaseUIComponentProps<NumberFieldRootState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id' | 'onChange'> {
  /**
   * The id of the input element.
   */
  id?: string | undefined;
  /**
   * The minimum value of the input element.
   */
  min?: number | undefined;
  /**
   * The maximum value of the input element.
   */
  max?: number | undefined;
  /**
   * When true, direct text entry may be outside the `min`/`max` range without clamping,
   * so native range underflow/overflow validation can occur.
   * Step-based interactions (keyboard arrows, buttons, wheel, scrub) still clamp.
   * @default false
   */
  allowOutOfRange?: boolean | undefined;
  /**
   * The small step value of the input element when incrementing while the alt key is held.
   * Snaps to multiples of this value when `snapOnStep` is enabled.
   * @default 0.1
   */
  smallStep?: number | undefined;
  /**
   * Amount to increment and decrement with the buttons and arrow keys, or to scrub with pointer movement in the scrub area.
   * To always enable step validation on form submission, specify the `min` prop explicitly in conjunction with this prop.
   * Specify `step="any"` to always disable step validation; interactive stepping then uses a base amount of `1`, while the alt and shift keys still step by `smallStep` and `largeStep`.
   * @default 1
   */
  step?: number | 'any' | undefined;
  /**
   * The large step value of the input element when incrementing while the shift key is held.
   * Snaps to multiples of this value when `snapOnStep` is enabled.
   * @default 10
   */
  largeStep?: number | undefined;
  /**
   * Whether the user must enter a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to change the field value.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the number field is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The raw numeric value of the field.
   */
  value?: number | null | undefined;
  /**
   * The uncontrolled value of the field when it's initially rendered.
   *
   * To render a controlled number field, use the `value` prop instead.
   */
  defaultValue?: number | undefined;
  /**
   * Whether to allow the user to scrub the input value with the mouse wheel while focused and
   * hovering over the input.
   * @default false
   */
  allowWheelScrub?: boolean | undefined;
  /**
   * Whether the value should snap to the nearest step when incrementing or decrementing.
   * @default false
   */
  snapOnStep?: boolean | undefined;
  /**
   * Options to format the input value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * The locale of the input element.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
}

export type NumberFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputBlur
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard
  | typeof REASONS.incrementPress
  | typeof REASONS.decrementPress
  | typeof REASONS.wheel
  | typeof REASONS.scrub
  | typeof REASONS.none;
export type NumberFieldRootChangeEventDetails = VaseUIChangeEventDetails<
  NumberFieldRootChangeEventReason,
  ChangeEventCustomProperties
>;

// `none` is kept for consistency with other components even though the number field never
// commits with it.
export type NumberFieldRootCommitEventReason =
  | typeof REASONS.inputBlur
  | typeof REASONS.inputClear
  | typeof REASONS.keyboard
  | typeof REASONS.incrementPress
  | typeof REASONS.decrementPress
  | typeof REASONS.wheel
  | typeof REASONS.scrub
  | typeof REASONS.none;
export type NumberFieldRootCommitEventDetails =
  VaseUIGenericEventDetails<NumberFieldRootCommitEventReason>;
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, provide, shallowRef, watch } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { formatNumber } from '../../common/formatNumber';
import { useIsHydrated } from '../../common/hydration';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { platform } from '../../common/platform';
import { activeElement } from '../../common/shadowDom';
import { useControlled } from '../../common/useControlled';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../common/visuallyHidden';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type { ReasonToEvent } from '../../internals/createBaseUIEventDetails';
import { useClearFieldError, useFieldRootContext } from '../../internals/field-root-context';
import { useFormContext } from '../../internals/form-context';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { useLabelableId } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useFormReset } from '../../internals/useFormReset';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import {
  BASE_NON_NUMERIC_SYMBOLS,
  getAllFormatParts,
  getLocaleDigits,
  getNumberLocaleDetails,
  MINUS_SIGNS_WITH_ASCII,
  PERCENTAGES,
  PERMILLE,
  PLUS_SIGNS_WITH_ASCII,
  SPACE_SEPARATOR_RE,
} from '../utils/parse';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import type { EventWithOptionalKeyState, IncrementValueParameters } from '../utils/types';
import { toValidatedNumber } from '../utils/validate';
import { NumberFieldRootContext } from './NumberFieldRootContext';
import type { InputMode } from './NumberFieldRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldRootProps>(), {
  as: 'div',
  smallStep: 0.1,
  step: 1,
  largeStep: 10,
  required: false,
  disabled: false,
  readOnly: false,
  value: undefined,
  allowWheelScrub: false,
  snapOnStep: false,
  allowOutOfRange: false,
});

const emit = defineEmits<{
  /**
   * Callback fired when the number value changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   * - `'input-change'` for parseable typing or programmatic text updates
   * - `'input-clear'` when the field becomes empty
   * - `'input-blur'` when formatting (and clamping, if enabled) occurs on blur
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for arrow-key/Home/End stepping (typing digits uses `'input-change'`/`'input-clear'`)
   * - `'increment-press'` / `'decrement-press'` for button presses on the increment and decrement controls
   * - `'wheel'` for wheel-based scrubbing
   * - `'scrub'` for scrub area drags
   */
  valueChange: [value: number | null, eventDetails: NumberFieldRootChangeEventDetails];
  'update:value': [value: number | null];
  /**
   * Callback function that is fired when the value is committed.
   * It runs later than `valueChange`, when:
   * - The input is blurred after typing a value.
   * - The pointer is released after scrubbing or pressing the increment/decrement buttons.
   *
   * It runs simultaneously with `valueChange` when interacting with the keyboard or the
   * mouse wheel.
   *
   * **Warning**: This is a generic event not a change event.
   */
  valueCommitted: [value: number | null, eventDetails: NumberFieldRootCommitEventDetails];
}>();

defineSlots<{
  default(props: { state: NumberFieldRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, NumberFieldRootState>;
}>();

const {
  setDirty,
  validityData,
  disabled: fieldDisabled,
  setFilled,
  name: fieldName,
  state: fieldState,
  validation,
} = useFieldRootContext();
const { clearErrors } = useFormContext();

const isDisabled = computed(() => (fieldDisabled.value ?? false) || props.disabled);
const inputName = computed(() => fieldName.value ?? props.name);
const clearFieldError = useClearFieldError(inputName);
const stepAmount = computed(() => (props.step === 'any' ? 1 : props.step));

const isScrubbing = shallowRef(false);

const minWithDefault = computed(() => props.min ?? Number.MIN_SAFE_INTEGER);
const maxWithDefault = computed(() => props.max ?? Number.MAX_SAFE_INTEGER);
const minWithZeroDefault = computed(() => props.min ?? 0);

const inputRef = shallowRef<HTMLInputElement | null>(null);
const hiddenInputElement = shallowRef<HTMLInputElement | null>(null);

// A template can mount the root that replaces this root before it unmounts this root. The root
// then clears the input of the field only when the input is its own. A plain variable keeps the
// render of the root from depending on the element.
let ownHiddenInput: HTMLInputElement | null = null;

function setHiddenInputElement(next: unknown) {
  const input = next as HTMLInputElement | null;
  // Vue calls a function ref again on each patch, with the same element.
  if (input === ownHiddenInput) {
    return;
  }
  if (input !== null || validation.inputRef.value === ownHiddenInput) {
    validation.inputRef.value = input;
  }
  ownHiddenInput = input;
  hiddenInputElement.value = input;
}

const controlId = useLabelableId({ id: () => props.id });

const [numberValue, setValueUnwrapped] = useControlled<number | null>({
  controlled: () => props.value,
  default: () => props.defaultValue ?? null,
  name: 'NumberField',
  state: 'value',
});

// The buttons write `valueRef`. A change of `value` writes it too, before the next render.
const valueRef = shallowRef(numberValue.value);
watch(numberValue, (next) => {
  valueRef.value = next;
});

// The server HTML of the root and of each part after it has the attribute.
setFilled(numberValue.value !== null);
watch(numberValue, (next) => setFilled(next !== null));

const formatOptionsRef = computed(() => props.format);
const hasPendingCommitRef = shallowRef(false);
const allowInputSyncRef = shallowRef(true);
const lastChangedValueRef = shallowRef<number | null>(null);
const isResetChangePending = shallowRef(false);

function onValueCommitted(nextValue: number | null, details: NumberFieldRootCommitEventDetails) {
  hasPendingCommitRef.value = false;
  emit('valueCommitted', nextValue, details);
}

// A server cannot know the locale of the visitor, so the text has the locale `en-US` until the
// root is mounted. The text then changes to the locale of the visitor.
const formatLocale = useFormatLocale(() => props.locale);
const inputValue = shallowRef(formatNumber(numberValue.value, formatLocale.value, props.format));
// The numeric keyboard of iOS has no minus key, and for `numeric` it has no decimal key. The mode
// is widened only as far as the minimum needs. A server cannot know the platform, so the first
// render has `numeric`.
const isHydrated = useIsHydrated();
const inputMode = computed<InputMode>(() => {
  if (!isHydrated.value || !platform.os.ios) {
    return 'numeric';
  }
  return minWithDefault.value >= 0 ? 'decimal' : 'text';
});
// `setValue` raises the count, so the text is formatted again also when the value did not change.
// A typed text can differ from the format of the same number.
const syncRequest = shallowRef(0);

function setInputValue(next: string) {
  inputValue.value = next;
}

function getAllowedNonNumericKeys() {
  const format = props.format;
  const parts = getAllFormatParts(formatLocale.value, format);

  const keys = new Set<string>(BASE_NON_NUMERIC_SYMBOLS);
  const addAll = (chars: readonly string[]) => chars.forEach((char) => keys.add(char));

  // Integer formats omit the decimal from `parts`, so fall back to the locale's separator in that
  // case; it must stay typeable regardless of whether the format renders a fraction.
  const decimal =
    parts.find((part) => part.type === 'decimal')?.value ??
    getNumberLocaleDetails(formatLocale.value, format).decimal;
  keys.add(decimal);

  // Allow every non-digit character the formatter renders — separators, currency symbols, units
  // (e.g. `km/h`, `°C`), exponent separators, and locale literals — decomposed per character
  // because the input validates the typed string one character at a time. Deriving these from
  // the formatter covers multi-character and locale-specific symbols of every part type
  // uniformly. `compact` suffixes (e.g. `K`/`M`) are excluded because `parseNumber` can't reverse
  // them, so allowing them would yield a silently incorrect value.
  parts.forEach((part) => {
    if (
      part.type === 'integer' ||
      part.type === 'fraction' ||
      part.type === 'exponentInteger' ||
      part.type === 'compact'
    ) {
      return;
    }
    addAll(Array.from(part.value));
    if (SPACE_SEPARATOR_RE.test(part.value)) {
      keys.add(' ');
    }
  });
  // Digits follow the locale's numbering system, such as `১২` in bn-BD
  addAll(getLocaleDigits(formatLocale.value, format));

  const formatStyle = format?.style;
  const allowPercentSymbols =
    formatStyle === 'percent' || (formatStyle === 'unit' && format?.unit === 'percent');
  const allowPermilleSymbols =
    formatStyle === 'percent' || (formatStyle === 'unit' && format?.unit === 'permille');

  // Tolerate percent/permille variants the formatter doesn't emit but users may type or paste.
  if (allowPercentSymbols) {
    addAll(PERCENTAGES);
  }
  if (allowPermilleSymbols) {
    addAll(PERMILLE);
  }

  // Allow plus sign in all cases; minus sign when negatives are valid, or when out-of-range
  // entry is allowed so native underflow validation can be triggered from the keyboard.
  // Exponent notations already allow it above for negative exponents (`2E-2`).
  addAll(PLUS_SIGNS_WITH_ASCII);
  if (minWithDefault.value < 0 || props.allowOutOfRange) {
    addAll(MINUS_SIGNS_WITH_ASCII);
    // Accounting formats show negatives in parentheses, such as `($1.00)`
    if (format?.currencySign === 'accounting') {
      addAll(['(', ')']);
    }
  }

  return keys;
}

function getStepAmount(event?: EventWithOptionalKeyState) {
  if (event?.altKey) {
    return props.smallStep;
  }
  if (event?.shiftKey) {
    return props.largeStep;
  }
  return stepAmount.value;
}

function setValue(
  unvalidatedValue: number | null,
  details: NumberFieldRootChangeEventDetails,
): boolean {
  const eventWithOptionalKeyState = details.event as EventWithOptionalKeyState;
  const dir = details.direction;

  // Direct text entry (typing, pasting, clearing, autofill) behaves natively; step-based
  // interactions (keyboard arrows, buttons, wheel, scrub) do not. All direct-entry reasons
  // (`input-change`, `input-clear`, `input-blur`, `input-paste`) share the `input-` prefix.
  const isInputReason = details.reason.startsWith('input-') || details.reason === REASONS.none;

  // Only allow out-of-range values for direct text entry. Step-based interactions still clamp.
  const shouldClampValue = !props.allowOutOfRange || !isInputReason;

  const validatedValue = toValidatedNumber(
    unvalidatedValue,
    dir ? getStepAmount(eventWithOptionalKeyState) * dir : undefined,
    minWithDefault.value,
    maxWithDefault.value,
    minWithZeroDefault.value,
    props.format,
    props.snapOnStep,
    eventWithOptionalKeyState?.altKey ?? false,
    shouldClampValue,
  );

  // Notify about a change even when the numeric value is unchanged for input reasons: the
  // typed text may clamp/snap to the current value, or differ while validation normalizes
  // it back to the existing value.
  const shouldFireChange =
    validatedValue !== numberValue.value ||
    (isInputReason && (unvalidatedValue !== numberValue.value || !allowInputSyncRef.value));

  if (shouldFireChange) {
    emit('valueChange', validatedValue, details);

    if (details.isCanceled) {
      // Report a vetoed change as not applied, so callers don't commit a value never stored.
      return false;
    }

    emit('update:value', validatedValue);
    setValueUnwrapped(validatedValue);
    setDirty(validatedValue !== validityData.value.initialValue);
    hasPendingCommitRef.value = true;
  }

  lastChangedValueRef.value = validatedValue;
  syncRequest.value += 1;

  return shouldFireChange;
}

function incrementValue(
  amount: number,
  { direction, currentValue, event, reason }: IncrementValueParameters,
) {
  const prevValue = currentValue == null ? valueRef.value : currentValue;
  const nativeEvent = event as ReasonToEvent<IncrementValueParameters['reason']> | undefined;

  if (typeof prevValue !== 'number') {
    // Seed an empty field with 0; `setValue` clamps it to the in-range value nearest 0
    // (e.g. `max` for a negative range). No `direction`: the seed isn't a step, so it must
    // not be directionally snapped.
    return setValue(0, createChangeEventDetails(reason, nativeEvent));
  }

  return setValue(
    prevValue + amount * direction,
    createChangeEventDetails(reason, nativeEvent, undefined, { direction }),
  );
}

// The text follows the value, the locale and the format. During direct typing we don't want to
// overwrite the user-provided text until blur, so the text changes only while `allowInputSyncRef`
// is `true`.
watch([numberValue, formatLocale, () => props.format, syncRequest], () => {
  if (!allowInputSyncRef.value) {
    return;
  }

  const nextInputValue = formatNumber(numberValue.value, formatLocale.value, props.format);

  if (nextInputValue !== inputValue.value) {
    setInputValue(nextInputValue);
  }
});

// Programmatic focus leaves the caret at the start (Chrome/Firefox) or selects the whole value
// (Safari). Store the caret at the end before focusing: every engine restores the stored
// selection on `focus()`, and a selection the consumer sets in `focusin` still wins. Keyboard
// and pointer focus keep the browser's native selection behavior.
function focusInput() {
  const input = inputRef.value;
  if (!input) {
    return;
  }
  const length = input.value.length;
  input.setSelectionRange(length, length);
  input.focus();
}

const isWheelScrubEnabled = computed(
  () => props.allowWheelScrub && !isDisabled.value && !props.readOnly,
);

// Vue adds the listener with no `passive` option, so `preventDefault` stops the scroll of the page.
function onInputWheel(event: WheelEvent) {
  const input = inputRef.value;
  if (!input) {
    return;
  }

  if (
    // Allow pinch-zooming.
    event.ctrlKey ||
    activeElement(ownerDocument(input)) !== input
  ) {
    return;
  }

  // Some browsers deliver shift + wheel on the horizontal axis, so there the horizontal
  // delta is the intended vertical one. Touchpads emit sub-pixel noise on the cross axis,
  // so compare the axes rather than requiring an exact zero.
  const isHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
  const delta = event.shiftKey && isHorizontal ? event.deltaX : event.deltaY;

  // Ignore horizontal gestures so the page can scroll instead of scrubbing. Shift is exempt:
  // its gesture is horizontal wherever the browser swaps the axis.
  if (delta === 0 || (!event.shiftKey && isHorizontal)) {
    return;
  }

  // Prevent the default behavior to avoid scrolling the page.
  event.preventDefault();
  allowInputSyncRef.value = true;

  const amount = getStepAmount(event);

  // Each wheel turn is a discrete, final change, so commit it immediately like keyboard
  // steps (gated on an actual change so boundary no-ops don't commit).
  const changed = incrementValue(amount, {
    direction: delta > 0 ? -1 : 1,
    event,
    reason: REASONS.wheel,
  });
  if (changed) {
    onValueCommitted(lastChangedValueRef.value, createGenericEventDetails(REASONS.wheel, event));
  }
}

const state = computed<NumberFieldRootState>(() => ({
  ...fieldState.value,
  disabled: isDisabled.value,
  readOnly: props.readOnly,
  required: props.required,
  value: numberValue.value,
  inputValue: inputValue.value,
  scrubbing: isScrubbing.value,
}));

provide(NumberFieldRootContext, {
  minWithDefault,
  maxWithDefault,
  id: controlId,
  form: computed(() => props.form),
  setValue,
  getStepAmount,
  incrementValue,
  inputRef,
  focusInput,
  allowInputSyncRef,
  formatOptionsRef,
  valueRef,
  lastChangedValueRef,
  hasPendingCommitRef,
  name: inputName,
  nameProp: computed(() => props.name),
  value: numberValue,
  disabled: isDisabled,
  inputMode,
  getAllowedNonNumericKeys,
  min: computed(() => props.min),
  max: computed(() => props.max),
  setInputValue,
  locale: formatLocale,
  setIsScrubbing(scrubbing: boolean) {
    isScrubbing.value = scrubbing;
  },
  state,
  onValueCommitted,
  onInputWheel,
  isWheelScrubEnabled,
  isResetChangePending,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping,
});

const hiddenInputText = computed(() =>
  numberValue.value === null ? '' : String(numberValue.value),
);

// The value that the hidden input had after the last event that the root handled. A write of Vue
// or of the root sets it too.
let handledValue: string | undefined;

function syncHandledValue() {
  handledValue = hiddenInputElement.value?.value;
}

onMounted(syncHandledValue);
watch(hiddenInputText, syncHandledValue, { flush: 'post' });

// Vue writes the value to the input only when the root renders. The root does not render when a
// listener cancels a change or the parent keeps the old value.
function writeValueToHiddenInput() {
  const input = hiddenInputElement.value;
  if (input && input.value !== hiddenInputText.value) {
    input.value = hiddenInputText.value;
  }
  syncHandledValue();
}

// An autofill sends `input` and then `change` for one value, and a program can send only `change`,
// or both events in one task. The value is new when the input did not have it after the last event
// that the root handled or the last write.
function onHiddenInputChange(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  if (input.value === handledValue) {
    return;
  }
  handledValue = input.value;

  // A listener that prevented the event stops the change.
  if (!event.defaultPrevented && !isDisabled.value && !props.readOnly) {
    // Handle browser autofill.
    const nextValue = input.valueAsNumber;
    const parsedValue = Number.isNaN(nextValue) ? null : nextValue;
    const details = createChangeEventDetails(REASONS.none, event);

    // `setValue` updates the dirty flag from the stored (clamped) value, so validate with
    // that same value rather than the raw autofilled one.
    setValue(parsedValue, details);
    clearErrors(inputName.value);
    validation.change(lastChangedValueRef.value ?? parsedValue);
  }

  // The input keeps the value of the field, as a controlled input of React does. A listener that
  // cancels the change, a parent that keeps its value and a locked field leave the field as it was.
  void nextTick(writeValueToHiddenInput);
}

useFormReset(hiddenInputElement, (event) => {
  if (props.value === undefined) {
    const previousValue = numberValue.value;
    allowInputSyncRef.value = true;
    setValue(props.defaultValue ?? null, createChangeEventDetails(REASONS.none, event));
    // A reset is not an edit of the user, so no commit follows it.
    hasPendingCommitRef.value = false;

    if (numberValue.value !== previousValue) {
      // A part validates a change of the value after the next DOM update. The flag stays set until
      // then, so no part validates the value of a reset.
      isResetChangePending.value = true;
      void nextTick(() => {
        isResetChangePending.value = false;
      });
    }
  }

  clearFieldError(numberValue.value);
});

watch(
  hiddenInputElement,
  (input, _previous, onCleanup) => {
    if (!input) {
      return;
    }

    // A browser can restore the form state of a page after the mount, with no event on the input.
    onCleanup(addEventListener(ownerWindow(input), 'pageshow', writeValueToHiddenInput));
  },
  { flush: 'post' },
);

// The style is the constant itself, in an object that no `mergeProps` call makes.
// `handleHiddenInputInvalid` then keeps the size that it writes.
function inputProps() {
  return {
    ...validation.getValidationProps(isDisabled.value),
    ref: setHiddenInputElement,
    type: 'number',
    form: props.form,
    name: inputName.value,
    value: hiddenInputText.value,
    min: props.min,
    max: props.max,
    // stepMismatch validation is broken unless an explicit `min` is added.
    // See https://github.com/react/react/issues/12334.
    step: props.step,
    disabled: isDisabled.value,
    readonly: props.readOnly,
    required: props.required,
    'aria-hidden': true,
    tabindex: -1,
    style: inputName.value ? visuallyHiddenInput : visuallyHiddenInputPinned,
    onInvalid: handleHiddenInputInvalid,
    onFocusin: focusInput,
    onInput: onHiddenInputChange,
    onChange: onHiddenInputChange,
  };
}

defineExpose({ element, inputElement: hiddenInputElement });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  <input v-bind="inputProps()" />
</template>
