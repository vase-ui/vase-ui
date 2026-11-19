<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import type { FieldRootState } from '../../field/types';
import { REASONS } from '../../internals/reasons';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ChangeEventCustomProperties } from '../utils/parse';

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
  modelValue?: number | null | undefined;
  /**
   * The uncontrolled value of the field when it's initially rendered.
   *
   * To render a controlled number field, use the `modelValue` prop instead.
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
import { computed, inject, nextTick, provide, shallowRef, useId, watch } from 'vue';
import { formatNumber } from '../../common/formatNumber';
import { useHiddenValueBeforeHydration } from '../../common/hydration';
import { ownerDocument } from '../../common/owner';
import { activeElement } from '../../common/shadowDom';
import { useControlled } from '../../common/useControlled';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../common/visuallyHidden';
import { fieldKey } from '../../field/control';
import { useInDisabledFieldset } from '../../fieldset/part';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import type { ReasonToEvent } from '../../internals/createVaseUIEventDetails';
import { DEFAULT_FIELD_STATE_ATTRIBUTES } from '../../internals/field-constants';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { useReferencedId } from '../../internals/labelable-provider/useRegisteredId';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useFormReset } from '../../internals/useFormReset';
import { useFormRestoreAsInput } from '../../internals/useFormRestore';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { parseNumber, toValidatedNumber } from '../utils/parse';
import { stateAttributesMapping, NumberFieldRootContext } from './NumberFieldRootContext';
import type { EventWithOptionalKeyState, IncrementValueParameters } from '../utils/parse';
import { given } from '../../internals/givenAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldRootProps>(), {
  as: 'div',
  smallStep: 0.1,
  step: 1,
  largeStep: 10,
  required: false,
  disabled: false,
  readOnly: false,
  modelValue: undefined,
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
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: number | null];
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

const field = inject(fieldKey, null);

const fieldsetDisabled = useInDisabledFieldset(() => element.value);
const isDisabled = computed(() => !!field?.disabled || fieldsetDisabled.value || props.disabled);
const inputName = computed(() => field?.name ?? props.name);

const isScrubbing = shallowRef(false);

const minWithDefault = computed(() => props.min ?? Number.MIN_SAFE_INTEGER);
const maxWithDefault = computed(() => props.max ?? Number.MAX_SAFE_INTEGER);

const inputRef = shallowRef<HTMLInputElement | null>(null);
const hiddenInputElement = shallowRef<HTMLInputElement | null>(null);

function setHiddenInputElement(node: unknown) {
  hiddenInputElement.value = node as HTMLInputElement | null;
}

function registerInput(input: HTMLInputElement) {
  inputRef.value = input;
  return () => {
    if (inputRef.value === input) inputRef.value = null;
  };
}

const generatedId = useId();
const controlId = computed(() => given('id', props.id) ?? field?.controlId ?? generatedId);
const inputId = useReferencedId(() => controlId.value, inputRef);

// The text input is the control of the field, or the hidden input of a root with no text input.
// The hidden input holds the value for the form and its validation.
watch(
  () => inputRef.value ?? hiddenInputElement.value,
  (input, _, onCleanup) => {
    if (!input || !field) return;
    onCleanup(
      field.setControl({
        element: input,
        get id() {
          return controlId.value;
        },
        get name() {
          return props.name;
        },
        get disabled() {
          return props.disabled || fieldsetDisabled.value;
        },
        get readOnly() {
          return props.readOnly;
        },
        get inputs() {
          return hiddenInputElement.value ? [hiddenInputElement.value] : [];
        },
        get focusElement() {
          return inputRef.value ?? undefined;
        },
      }),
    );
  },
  { flush: 'post' },
);

const numberValue = useControlled<number | null>({
  controlled: () => props.modelValue,
  default: () => props.defaultValue ?? null,
  name: 'NumberField',
  state: 'value',
});

// A press can accept typed text and take its first step before the model patch.
let stepValue = numberValue.value;
watch(
  numberValue,
  (value) => {
    stepValue = value;
    field?.setValue(value, value !== null);
  },
  { immediate: true },
);

const hasPendingCommitRef = shallowRef(false);
let editing = false;
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
// `setValue` raises the count, so the text is formatted again also when the value did not change.
// A typed text can differ from the format of the same number.
const syncRequest = shallowRef(0);

function setEditing(next: boolean) {
  const previous = editing;
  editing = next;
  return previous;
}

function prepareStep() {
  const wasEditing = setEditing(false);
  if (!wasEditing) lastChangedValueRef.value = stepValue;
  return wasEditing;
}

function prepareStepper(
  event: MouseEvent,
  reason: typeof REASONS.incrementPress | typeof REASONS.decrementPress,
  hold = false,
) {
  if (prepareStep()) {
    const parsed = parseNumber(inputValue.value, formatLocale.value, props.format);
    if (parsed !== null) {
      const details = createChangeEventDetails(reason, event);
      setValue(parsed, details);
      if (!details.isCanceled) stepValue = parsed;
    }
  }
  if (hold) lastChangedValueRef.value = null;
  return stepValue;
}

function getStepCommitValue() {
  return lastChangedValueRef.value ?? stepValue;
}

function setInputValue(next: string) {
  inputValue.value = next;
}

function getStepAmount(event?: EventWithOptionalKeyState) {
  if (event?.altKey) {
    return props.smallStep;
  }
  if (event?.shiftKey) {
    return props.largeStep;
  }
  return props.step === 'any' ? 1 : props.step;
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
    props.min ?? 0,
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
    (isInputReason && (unvalidatedValue !== numberValue.value || editing));

  if (shouldFireChange) {
    emit('valueChange', validatedValue, details);

    if (details.isCanceled) {
      // Report a vetoed change as not applied, so callers don't commit a value never stored.
      return false;
    }

    emit('update:modelValue', validatedValue);
    numberValue.value = validatedValue;
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
  const prevValue = currentValue ?? stepValue;
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

// Keep an unfinished edit through a change of locale or format.
watch([numberValue, formatLocale, () => props.format, syncRequest], () => {
  if (editing) {
    return;
  }

  inputValue.value = formatNumber(numberValue.value, formatLocale.value, props.format);
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
  editing = false;

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
  ...(field?.state ?? DEFAULT_FIELD_STATE_ATTRIBUTES),
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
  inputId,
  setValue,
  getStepAmount,
  incrementValue,
  inputRef,
  registerInput,
  options: props,
  setEditing,
  prepareStep,
  prepareStepper,
  getStepCommitValue,
  focusInput,
  lastChangedValueRef,
  hasPendingCommitRef,
  name: inputName,
  value: numberValue,
  disabled: isDisabled,
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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping,
});

const writesHiddenValue = useHiddenValueBeforeHydration(() => hiddenInputElement.value);
// When both inputs changed before hydration, the edit in the visible input sets the model first.
const hiddenInputText = computed<string | null>((previous) => {
  const value = numberValue.value;
  if (!writesHiddenValue.value && previous === undefined) {
    return null;
  }
  return value === null ? '' : String(value);
});

const { valueProps, renderValue } = useFormRestoreAsInput(
  hiddenInputElement,
  () => hiddenInputText.value,
  false,
);

function onHiddenInputChange(event: Event) {
  const input = event.currentTarget as HTMLInputElement;

  // A listener that prevented the event stops the change.
  if (!event.defaultPrevented && !isDisabled.value && !props.readOnly) {
    // Handle browser autofill.
    const nextValue = input.valueAsNumber;
    const parsedValue = Number.isNaN(nextValue) ? null : nextValue;
    const details = createChangeEventDetails(REASONS.none, event);

    // `setValue` updates the dirty flag from the stored (clamped) value, so validate with
    // that same value rather than the raw autofilled one.
    setValue(parsedValue, details);
    void nextTick(() => field?.onEdit());
  }

  renderValue();
}

useFormReset(hiddenInputElement, (event) => {
  if (props.modelValue === undefined) {
    const previousValue = numberValue.value;
    editing = false;
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

  field?.onReset(numberValue.value);
});

defineExpose({ element, inputElement: hiddenInputElement });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <input
    :ref="setHiddenInputElement"
    v-bind="hiddenInputText === null ? undefined : valueProps()"
    type="number"
    :form="props.form"
    :name="inputName"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :disabled="isDisabled"
    :readonly="props.readOnly"
    :required="props.required"
    aria-hidden="true"
    tabindex="-1"
    :style="inputName ? visuallyHiddenInput : visuallyHiddenInputPinned"
    @invalid="handleHiddenInputInvalid"
    @focusin="focusInput"
    @input="onHiddenInputChange"
  />
</template>
