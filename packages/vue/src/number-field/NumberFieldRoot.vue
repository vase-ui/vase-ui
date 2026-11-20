<script setup lang="ts">
import { computed, inject, mergeProps, nextTick, provide, shallowRef, useAttrs, watch } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement } from '../common/element';
import { useFormReset } from '../common/formEvents';
import { useModel } from '../common/model';
import { visuallyHiddenInput } from '../common/visuallyHidden';
import { fieldKey } from '../field/control';
import { useInDisabledFieldset } from '../fieldset/part';
import { useLocale } from '../locale-provider/part';
import { numberFieldKey, stateAttributes, type StepKeys } from './root';
import { intoRange, roundInRange, stepValue } from './step';
import { createNumberText } from './text';
import type {
  NumberFieldRootChangeEventDetails,
  NumberFieldRootChangeEventReason,
  NumberFieldRootCommitEventDetails,
  NumberFieldRootCommitEventReason,
  NumberFieldRootProps,
  NumberFieldRootState,
} from './types';

type Value = number | null;

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldRootProps>(), {
  smallStep: 0.1,
  largeStep: 10,
  snapOnStep: false,
  allowOutOfRange: false,
  allowWheelScrub: false,
  required: false,
  disabled: false,
  readonly: false,
});
const emit = defineEmits<{
  /** The user changes the value. `details.cancel()` keeps the value as it was. */
  valueChange: [value: Value, details: NumberFieldRootChangeEventDetails];
  /** Comes after the change event with the new value, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: Value];
  /** The user ends a change: at the blur after typed edits, a key, a wheel step, a release or a fill. */
  valueCommitted: [value: Value, details: NumberFieldRootCommitEventDetails];
}>();
defineSlots<{ default?(scope: { state: NumberFieldRootState }): unknown }>();

const attrs = useAttrs();
const field = inject(fieldKey, null);
const { element, setElement } = useElement<HTMLElement>();
const { element: hiddenInput, setElement: setHiddenInput } = useElement<HTMLInputElement>();
const inDisabledFieldset = useInDisabledFieldset(element);
const textLocale = useLocale(() => props.locale);

const asValue = (value: number | null | undefined): Value =>
  value === null || value === undefined || Number.isNaN(value) ? null : value;
const model = () => (props.modelValue === undefined ? undefined : asValue(props.modelValue));
const firstModel = model();
/** The value of the mount, which a native reset gives back. */
const firstValue = firstModel === undefined ? asValue(props.defaultValue) : firstModel;
const { value, setOwn } = useModel(model, firstValue);

// A format with the same content is the same format, so that an inline object of the parent does
// not format typed text again at each render.
const formatKey = computed(() => JSON.stringify(props.format ?? {}));
const numberText = computed(() =>
  createNumberText(textLocale.value, JSON.parse(formatKey.value) as Intl.NumberFormatOptions),
);
// The text that the user typed, and the value that it gave. It shows while that value is the value.
const typed = shallowRef<{ text: string; value: Value } | null>(null);
const inputValue = computed(() =>
  typed.value && typed.value.value === value.value
    ? typed.value.text
    : numberText.value.format(value.value),
);
const input = shallowRef<{ readonly element: HTMLInputElement; readonly id: string }>();

const isDisabled = computed(() => props.disabled || !!field?.disabled || inDisabledFieldset.value);
const scrubs = shallowRef(0);
const state = computed<NumberFieldRootState>(() => ({
  value: value.value,
  inputValue: inputValue.value,
  required: props.required,
  disabled: isDisabled.value,
  readonly: props.readonly,
  scrubbing: scrubs.value > 0,
  touched: field?.state.touched ?? false,
  dirty: field?.state.dirty ?? false,
  valid: field?.state.valid ?? null,
  filled: field?.state.filled ?? false,
}));
/** The range of a value that the user typed, pasted or filled. */
const typedRange = computed(() =>
  props.allowOutOfRange ? { min: undefined, max: undefined } : { min: props.min, max: props.max },
);

// The user typed since the focus or the last commit.
let edited = false;
// The value of the last commit, or of the focus.
let committed: Value = firstValue;

watch(numberText, (_, before) => {
  // Typed text that is a number takes the new format. Other typed text stays.
  if (typed.value && before.parse(typed.value.text) !== undefined) typed.value = null;
});

watch(value, (next) => field?.setValue(next, next !== null), { immediate: true });

watch(
  [hiddenInput, input],
  ([hidden, text], _, onCleanup) => {
    if (!hidden || !field) return;
    onCleanup(
      field.setControl({
        element: text?.element ?? hidden,
        get id() {
          return text?.id ?? hidden.id;
        },
        get name() {
          return props.name;
        },
        get disabled() {
          return props.disabled || inDisabledFieldset.value;
        },
        get readOnly() {
          return props.readonly;
        },
        // The browser validates the hidden input, which has the value and the constraints. It
        // gives the focus to the text input.
        inputs: [hidden],
      }),
    );
  },
  { flush: 'post' },
);

useFormReset(hiddenInput, () => {
  field?.onReset(firstValue);
  typed.value = null;
  edited = false;
  if (value.value !== firstValue) {
    setOwn(firstValue);
    emit('update:modelValue', firstValue);
  }
});

provide(numberFieldKey, {
  get state() {
    return state.value;
  },
  get text() {
    return numberText.value;
  },
  field,
  get min() {
    return props.min;
  },
  get max() {
    return props.max;
  },
  get form() {
    return props.form;
  },
  get allowWheelScrub() {
    return props.allowWheelScrub;
  },
  get negative() {
    return props.min === undefined || props.min < 0 || props.allowOutOfRange;
  },
  get inputId() {
    return input.value?.id;
  },
  get hiddenInput() {
    return hiddenInput.value;
  },
  setInput(added) {
    input.value = added;
    return () => (input.value = undefined);
  },
  atBound(direction) {
    const current = value.value;
    const bound = direction > 0 ? props.max : props.min;
    return (
      current !== null &&
      bound !== undefined &&
      (direction > 0 ? current >= bound : current <= bound)
    );
  },
  edit,
  holdText(text) {
    typed.value = { text, value: value.value };
  },
  startEdit() {
    committed = value.value;
  },
  endEdit,
  step: stepBy,
  change,
  commit,
  focusInput,
  setScrubbing(scrubbing) {
    scrubs.value += scrubbing ? 1 : -1;
  },
});

defineExpose({ element, inputElement: hiddenInput });

function elementProps() {
  return mergeProps(stateAttributes(state.value), attrs);
}

function hiddenProps() {
  return {
    type: 'number',
    'aria-hidden': 'true' as const,
    tabindex: -1,
    name: field?.name ?? props.name,
    form: props.form,
    min: props.min,
    max: props.max,
    // With no number in `step`, a step is 1 and the form accepts each number.
    step: typeof props.step === 'number' ? props.step : 'any',
    required: props.required,
    readonly: props.readonly,
    disabled: isDisabled.value,
    // Vue writes the `value` attribute too, so the browser takes the step base from it when there
    // is no `min` (measured).
    value: asText(value.value),
    style: visuallyHiddenInput,
    onInput: onFill,
    // The browser focuses the hidden input at an invalid submit, and so can a form library.
    onFocus: focusInput,
  };
}

function asText(number: Value) {
  return number === null ? '' : String(number);
}

// Vue writes a value only when it changes. After a refused or cancelled change the inputs must
// show the value again.
function showInputs() {
  const hidden = hiddenInput.value;
  if (hidden && hidden.value !== asText(value.value)) hidden.value = asText(value.value);
  const text = input.value?.element;
  if (text && text.value !== inputValue.value) text.value = inputValue.value;
}

function change(
  next: Value,
  reason: NumberFieldRootChangeEventReason,
  event: Event,
  direction?: 1 | -1,
) {
  const details = createChangeEventDetails(reason, event) as NumberFieldRootChangeEventDetails;
  if (direction) details.direction = direction;
  emit('valueChange', next, details);
  if (details.isCanceled) {
    nextTick(showInputs);
    return false;
  }
  setOwn(next);
  emit('update:modelValue', next);
  // The parent answers a controlled change with its next render.
  nextTick(() => {
    showInputs();
    field?.onEdit();
  });
  return true;
}

function commit(next: Value, reason: NumberFieldRootCommitEventReason, event: Event) {
  edited = false;
  committed = next;
  emit('valueCommitted', next, { reason, event } as NumberFieldRootCommitEventDetails);
}

function edit(text: string, reason: 'input-change' | 'input-paste', event: Event) {
  edited = true;
  const parsed = numberText.value.parse(text);
  let next = value.value;
  if (parsed === null) next = null;
  else if (parsed !== undefined)
    next = intoRange(parsed, typedRange.value.min, typedRange.value.max);
  typed.value = { text, value: next };
  if (next !== value.value) change(next, parsed === null ? 'input-clear' : reason, event);
}

function endEdit(event: FocusEvent) {
  field?.onLeave(event.currentTarget as Element);
  const last = typed.value;
  if (!edited) {
    // Typed text that is not a number stays at the blur that ends its edit, and goes at the next.
    typed.value = null;
    return;
  }
  edited = false;
  // A typed number shows in the format. Other typed text stays.
  const typedNumber = !!last && numberText.value.parse(last.text) !== undefined;
  if (typedNumber) typed.value = null;
  let final = value.value;
  // A rounding option of the format rounds the number that the user typed.
  if (typedNumber && final !== null && last?.value === final) {
    const rounded = roundInRange(final, { ...typedRange.value, round: numberText.value.round });
    if (rounded !== final && change(rounded, 'input-blur', event)) final = rounded;
  }
  if (final !== committed) commit(final, final === null ? 'input-clear' : 'input-blur', event);
}

function stepBy(
  direction: 1 | -1,
  keys: StepKeys,
  reason: NumberFieldRootChangeEventReason,
  event: Event,
  count = 1,
) {
  const current = value.value;
  const small = keys.altKey;
  const amount = small
    ? props.smallStep
    : keys.shiftKey
      ? props.largeStep
      : typeof props.step === 'number'
        ? props.step
        : 1;
  // An empty field steps to 0, in the range.
  const next =
    current === null
      ? intoRange(0, props.min, props.max)
      : stepValue(
          current,
          { direction, amount, count, small },
          {
            snap: props.snapOnStep,
            min: props.min,
            max: props.max,
            round: numberText.value.round,
          },
        );
  if (next === current) return undefined;
  return change(next, reason, event, current === null ? undefined : direction) ? next : undefined;
}

function focusInput() {
  const el = input.value?.element;
  if (!el) return;
  // `focus()` puts the caret at 0 in Chromium and Firefox and selects the text in WebKit. A caret
  // set before the focus stays, and a `focusin` listener of the developer can still select
  // (measured).
  el.setSelectionRange(el.value.length, el.value.length);
  el.focus();
}

function onFill(event: Event) {
  const { valueAsNumber } = event.currentTarget as HTMLInputElement;
  const next = Number.isNaN(valueAsNumber)
    ? null
    : intoRange(valueAsNumber, typedRange.value.min, typedRange.value.max);
  if (!isDisabled.value && !props.readonly && next !== value.value) {
    if (change(next, 'none', event)) commit(next, 'none', event);
  }
  nextTick(showInputs);
}
</script>

<template>
  <component :is="as" v-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
    <input v-bind="hiddenProps()" :ref="setHiddenInput" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
    <input v-bind="hiddenProps()" :ref="setHiddenInput" />
  </div>
</template>
