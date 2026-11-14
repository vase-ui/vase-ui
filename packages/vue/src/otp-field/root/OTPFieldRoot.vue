<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import { REASONS } from '../../internals/reasons';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { OTPValidationType } from '../utils/otp';
import type { OTPFieldInputMode } from './OTPFieldRootContext';

export interface OTPFieldRootState extends FieldRootState {
  /**
   * Whether all slots are filled.
   */
  complete: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The number of OTP input slots.
   */
  length: number;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: boolean;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: boolean;
  /**
   * The OTP value.
   */
  value: string;
}

export interface OTPFieldRootProps
  extends
    VaseUIComponentProps<OTPFieldRootState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id' | 'inputmode' | 'onChange'> {
  /**
   * The id of the first input element.
   * Subsequent inputs derive their ids from it (`{id}-2`, `{id}-3`, and so on).
   */
  id?: string | undefined;
  /**
   * The input autocomplete attribute. Applied to the first slot and hidden validation input.
   * @default 'one-time-code'
   */
  autoComplete?: string | undefined;
  /**
   * A string specifying the `form` element with which the hidden input is associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string | undefined;
  /**
   * The number of OTP input slots.
   * Required so the root can clamp values, detect completion, and generate
   * consistent validation markup before all slots hydrate.
   */
  length: number;
  /**
   * Whether to submit the owning form when the OTP becomes complete.
   * @default false
   */
  autoSubmit?: boolean | undefined;
  /**
   * Whether the slot inputs should mask entered characters.
   * Pass `type` directly to individual `<OTPField.Input>` parts to use a custom
   * input type.
   * @default false
   */
  mask?: boolean | undefined;
  /**
   * The virtual keyboard hint applied to the slot inputs and hidden validation input.
   *
   * Built-in validation modes provide sensible defaults, but you can override them when needed.
   */
  inputMode?: OTPFieldInputMode | undefined;
  /**
   * The type of input validation to apply to the OTP value.
   * @default 'numeric'
   */
  validationType?: OTPFieldRootValidationType | undefined;
  /**
   * Function that normalizes the OTP value after whitespace and `validationType` filtering.
   * It runs whenever OTP Field normalizes a value, including initial/default values, controlled
   * values, and user edits.
   *
   * The returned value is filtered by `validationType` again, then clamped to `length`.
   * It should be idempotent because OTP Field may normalize the same value more than once while
   * handling edits, storing state, and rendering controlled or uncontrolled values. Non-idempotent
   * normalizers can compound across those normalization passes. Characters rejected while
   * normalizing typed or pasted text are reported through `valueInvalid`.
   */
  normalizeValue?: ((value: string) => string) | undefined;
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
   * The OTP value.
   */
  value?: string | undefined;
  /**
   * The uncontrolled OTP value when the component is initially rendered.
   */
  defaultValue?: string | undefined;
  /**
   * The ids of the elements that name the group. With this prop, the inputs do not take the label
   * of the field.
   */
  ariaLabelledby?: string | undefined;
}

export type OTPFieldRootValidationType = OTPValidationType;

export type OTPFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard
  | typeof REASONS.none;
export type OTPFieldRootChangeEventDetails =
  VaseUIChangeEventDetails<OTPFieldRootChangeEventReason>;

export type OTPFieldRootInvalidEventReason = typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootInvalidEventDetails =
  VaseUIGenericEventDetails<OTPFieldRootInvalidEventReason>;

export type OTPFieldRootCompleteEventReason =
  typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootCompleteEventDetails =
  VaseUIGenericEventDetails<OTPFieldRootCompleteEventReason>;
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, provide, shallowRef, watch } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { clamp } from '../../common/clamp';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { useControlled } from '../../common/useControlled';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../common/visuallyHidden';
import { warn } from '../../common/warn';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { useRegisterFieldControl } from '../../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../../internals/field-root-context';
import { useFormContext } from '../../internals/form-context';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import {
  useAriaLabelledBy,
  useControlLabelId,
  useLabelableContext,
  useLabelableId,
} from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useFormReset } from '../../internals/useFormReset';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import {
  getOTPValidationConfig,
  normalizeOTPValue,
  normalizeOTPValueWithDetails,
} from '../utils/otp';
import { rootStateAttributesMapping } from '../utils/stateAttributesMapping';
import { OTPFieldRootContext } from './OTPFieldRootContext';
import OTPFieldRootHiddenInput from './OTPFieldRootHiddenInput.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<OTPFieldRootProps>(), {
  as: 'div',
  autoComplete: 'one-time-code',
  autoSubmit: false,
  mask: false,
  validationType: 'numeric',
  disabled: false,
  readOnly: false,
  required: false,
  value: undefined,
});

const emit = defineEmits<{
  /**
   * Callback fired when the OTP value changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   * - `'input-change'` for typing or autofill
   * - `'input-clear'` when a character is removed by text input
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for keyboard interactions that change the value
   * - `'none'` for a native reset of the form
   */
  valueChange: [value: string, eventDetails: OTPFieldRootChangeEventDetails];
  'update:value': [value: string];
  /**
   * Callback fired when entered text contains characters that are rejected by validation or
   * normalization before the OTP value updates.
   *
   * The `value` argument is the attempted user-entered string before normalization.
   */
  valueInvalid: [value: string, eventDetails: OTPFieldRootInvalidEventDetails];
  /**
   * Callback function that is fired when the OTP value becomes complete, or when a complete value
   * is pasted while the OTP is already complete.
   *
   * When the value changes, it runs later than `valueChange`, after the internal value update is
   * applied. If a complete pasted value matches the current value, `valueChange` does not fire.
   *
   * If `autoSubmit` is enabled, it runs immediately before the owning form is submitted.
   */
  valueComplete: [value: string, eventDetails: OTPFieldRootCompleteEventDetails];
}>();

defineSlots<{
  default(props: { state: OTPFieldRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, OTPFieldRootState>;
}>();

const {
  setDirty,
  validityData,
  disabled: fieldDisabled,
  setFilled,
  invalid,
  name: fieldName,
  state: fieldState,
  validation,
  validationMode,
  setFocused: setFieldFocused,
  setTouched,
} = useFieldRootContext();
const { clearErrors } = useFormContext();
const { getDescriptionProps } = useLabelableContext();

const isDisabled = computed(() => (fieldDisabled.value ?? false) || props.disabled);
const inputName = computed(() => fieldName.value ?? props.name);
const clearFieldError = useClearFieldError(inputName);

const [valueUnwrapped, setValueUnwrapped] = useControlled<string>({
  controlled: () => props.value,
  default: () => props.defaultValue ?? '',
  name: 'OTPField',
  state: 'value',
});

const inputElements = shallowRef<Array<HTMLElement | null>>([]);
const hiddenInputElement = shallowRef<HTMLInputElement | null>(null);
const inputCount = shallowRef(0);

let pendingFocus: { index: number; value: string } | null = null;
let pendingCompleteValue: {
  value: string;
  eventDetails: OTPFieldRootCompleteEventDetails;
} | null = null;

const firstInput = () => (inputElements.value[0] as HTMLInputElement | undefined) ?? null;

// The list sorts its elements after the callback of `useValueChanged` when one render changes the
// value and removes slots. An element that left the document is then still in the list.
const getConnectedInputs = () => inputElements.value.filter((input) => input?.isConnected);

const controlId = useLabelableId({ id: () => props.id });
const ariaLabelledBy = useAriaLabelledBy(
  () => props.ariaLabelledby,
  useControlLabelId(),
  firstInput,
  true,
  controlId,
);
const inputAriaLabelledBy = computed(() =>
  props.ariaLabelledby == null ? ariaLabelledBy.value : undefined,
);

const validationConfig = computed(() => getOTPValidationConfig(props.validationType));
const pattern = computed(() => validationConfig.value?.slotPattern);
const hiddenInputPattern = computed(() => validationConfig.value?.getRootPattern(props.length));
const resolvedInputMode = computed(() => props.inputMode ?? validationConfig.value?.inputMode);
const hasValidLength = computed(() => Number.isInteger(props.length) && props.length > 0);

const otpValue = computed(() =>
  normalizeOTPValue(valueUnwrapped.value, props.length, props.validationType, props.normalizeValue),
);
const filled = computed(() => otpValue.value !== '');

const focusedIndex = shallowRef(Math.min(otpValue.value.length, props.length - 1));
const focused = shallowRef(false);

const activeIndex = computed(() =>
  focused.value
    ? Math.min(focusedIndex.value, Math.max(props.length - 1, 0))
    : Math.min(otpValue.value.length, props.length - 1),
);

setFilled(filled.value);
watch(filled, setFilled);

useCompositeList({
  elementsRef: inputElements,
  onMapChange(newMap) {
    inputCount.value = newMap.size;
  },
});

if (process.env.NODE_ENV !== 'production') {
  watch(
    [inputCount, () => props.length],
    ([count, length]) => {
      if (!Number.isInteger(length) || length <= 0 || count === 0 || count === length) {
        return;
      }

      warn(
        '<OTPField.Root> `length` must match the number of rendered ' +
          `<OTPField.Input /> parts. Received \`length={${length}}\` but rendered ` +
          `${count} input${count === 1 ? '' : 's'}.`,
      );
    },
    { flush: 'post' },
  );

  const checkLength = () => {
    const { length } = props;
    if (Number.isInteger(length) && length > 0) {
      return;
    }

    warn(
      `<OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(length)}}\`.`,
    );
  };

  onMounted(checkLength);
  watch(() => props.length, checkLength, { flush: 'post' });
}

useRegisterFieldControl(
  firstInput,
  controlId,
  () => otpValue.value,
  undefined,
  () => !isDisabled.value,
  () => props.name,
);

function focusInput(index: number) {
  const elements = getConnectedInputs();
  const targetIndex = clamp(index, 0, Math.max(elements.length - 1, 0));
  const target = elements[targetIndex] as HTMLInputElement | null | undefined;
  target?.focus();
  target?.select();
}

function queueFocusInput(index: number, nextValue: string) {
  pendingFocus = { index, value: nextValue };
}

function requestSubmit() {
  // Not `validation.inputRef`: outside a Field, every control shares it.
  // The hidden input only renders for a valid `length` and the slots may be portaled,
  // so prefer the hidden input's form before falling back to the first slot.
  let formElement = hiddenInputElement.value?.form ?? firstInput()?.form ?? null;

  if (props.form) {
    const associatedElement = ownerDocument(element.value).getElementById(props.form);
    if (associatedElement?.tagName === 'FORM') {
      formElement = associatedElement as HTMLFormElement;
    }
  }

  if (formElement && typeof formElement.requestSubmit === 'function') {
    formElement.requestSubmit();
  }
}

function completeValue(completedValue: string, eventDetails: OTPFieldRootCompleteEventDetails) {
  emit('valueComplete', completedValue, eventDetails);

  if (props.autoSubmit) {
    requestSubmit();
  }
}

// The change of a reset reaches `useValueChanged` after the reset timeout. A clear in the timeout
// would come before `validation.change`, and the validation could show a new error. The timeout sets
// this flag, and the callback clears the field and starts no validation.
let isResetChangePending = false;

useValueChanged(otpValue, () => {
  clearErrors(inputName.value);
  setDirty(otpValue.value !== validityData.value.initialValue);

  if (isResetChangePending) {
    isResetChangePending = false;
    clearFieldError(otpValue.value);
  } else {
    validation.change(otpValue.value);
  }

  const queuedFocus = pendingFocus;

  if (queuedFocus != null) {
    pendingFocus = null;

    if (queuedFocus.value === otpValue.value) {
      focusInput(queuedFocus.index);
    }
  }

  // When the value shrinks externally, move focus off slots past the first empty one so typing
  // and Backspace keep working.
  const focusedElement = activeElement(ownerDocument(element.value));

  if (
    focusedElement &&
    getConnectedInputs().indexOf(focusedElement as HTMLInputElement) > otpValue.value.length
  ) {
    focusInput(otpValue.value.length);
    // Slots may not have their updated indexes yet when leading slots unmount, so sync the
    // tab stop with the redirect target directly.
    focusedIndex.value = otpValue.value.length;
  }

  const queuedCompleteValue = pendingCompleteValue;

  if (queuedCompleteValue != null) {
    pendingCompleteValue = null;

    if (queuedCompleteValue.value === otpValue.value) {
      completeValue(otpValue.value, queuedCompleteValue.eventDetails);
    }
  }
});

function setValue(nextValue: string, details: OTPFieldRootChangeEventDetails) {
  const { length } = props;
  const normalizedValue = normalizeOTPValue(
    nextValue,
    length,
    props.validationType,
    props.normalizeValue,
  );
  const canComplete =
    details.reason === REASONS.inputChange || details.reason === REASONS.inputPaste;
  const completeEventDetails =
    canComplete &&
    normalizedValue.length === length &&
    (otpValue.value.length !== length || details.reason === REASONS.inputPaste)
      ? createGenericEventDetails(details.reason, details.event)
      : null;

  if (normalizedValue === otpValue.value) {
    if (completeEventDetails != null) {
      completeValue(normalizedValue, completeEventDetails);
    }

    return null;
  }

  emit('valueChange', normalizedValue, details);

  if (details.isCanceled) {
    return null;
  }

  emit('update:value', normalizedValue);
  setValueUnwrapped(normalizedValue);

  if (completeEventDetails != null) {
    pendingCompleteValue = {
      value: normalizedValue,
      eventDetails: completeEventDetails,
    };
  } else if (normalizedValue.length !== length) {
    pendingCompleteValue = null;
  }

  return normalizedValue;
}

function reportValueInvalid(invalidValue: string, details: OTPFieldRootInvalidEventDetails) {
  emit('valueInvalid', invalidValue, details);
}

function handleInputFocus(index: number, event: FocusEvent) {
  if (index > otpValue.value.length) {
    focusInput(Math.min(otpValue.value.length, props.length - 1));
    return;
  }

  focusedIndex.value = index;
  (event.currentTarget as HTMLInputElement).select();
}

function handleInputBlur(event: FocusEvent) {
  if (contains(element.value, event.relatedTarget as Element | null)) {
    return;
  }

  setTouched(true);
  focused.value = false;
  setFieldFocused(false);

  if (validationMode.value === 'onBlur') {
    void validation.commit(otpValue.value);
  }
}

function getInputId(index: number) {
  const id = controlId.value;
  if (id == null) {
    return undefined;
  }

  return index === 0 ? id : `${id}-${index + 1}`;
}

const state = computed<OTPFieldRootState>(() => ({
  ...fieldState.value,
  complete: otpValue.value.length === props.length,
  disabled: isDisabled.value,
  filled: filled.value,
  focused: focused.value,
  length: props.length,
  readOnly: props.readOnly,
  required: props.required,
  value: otpValue.value,
}));

provide(OTPFieldRootContext, {
  activeIndex,
  autoComplete: computed(() => props.autoComplete),
  disabled: isDisabled,
  form: computed(() => props.form),
  focusInput,
  queueFocusInput,
  getInputId,
  handleInputBlur,
  handleInputFocus,
  inputMode: resolvedInputMode,
  inputAriaLabelledBy,
  invalid,
  length: computed(() => props.length),
  mask: computed(() => props.mask),
  pattern,
  reportValueInvalid,
  readOnly: computed(() => props.readOnly),
  required: computed(() => props.required),
  normalizeValue: computed(() => props.normalizeValue),
  setFocused(nextFocused: boolean) {
    focused.value = nextFocused;
  },
  setValue,
  state,
  validationType: computed(() => props.validationType),
  value: otpValue,
});

function mergeAriaIds(...values: Array<string | undefined>) {
  const ids = values.flatMap((ids) => ids?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? Array.from(new Set(ids)).join(' ') : undefined;
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: rootStateAttributesMapping,
  props: (attrs) => {
    const { 'aria-describedby': ariaDescribedBy, ...elementAttrs } = attrs;
    return [
      {
        role: 'group',
        'aria-describedby': mergeAriaIds(
          ariaDescribedBy as string | undefined,
          getDescriptionProps({})['aria-describedby'] as string | undefined,
        ),
        'aria-labelledby': ariaLabelledBy.value,
      },
      elementAttrs,
    ];
  },
});

// The value that the root last saw in the hidden input. The root sets it after each event that it
// handles, after each write of its own and after each write of Vue.
let handledHiddenValue: string | undefined;

// Vue writes `value` to an input only when the root renders. The root does not render when a
// listener cancels the change or when the parent keeps its value. It also does not render when the
// browser restores the form state of a page, which sends no event to the inputs.
function writeValueToInputs() {
  const hiddenInput = hiddenInputElement.value;
  if (hiddenInput && hiddenInput.value !== otpValue.value) {
    hiddenInput.value = otpValue.value;
  }
  handledHiddenValue = hiddenInput?.value;

  const characters = otpValue.value;
  inputElements.value.forEach((input, index) => {
    const slotValue = characters[index] ?? '';
    if (input && (input as HTMLInputElement).value !== slotValue) {
      (input as HTMLInputElement).value = slotValue;
    }
  });
}

function handleHiddenInput(event: Event) {
  const rawValue = (event.currentTarget as HTMLInputElement).value;
  handledHiddenValue = rawValue;

  if (!event.defaultPrevented && !isDisabled.value && !props.readOnly) {
    const [normalizedValue, didRejectCharacters] = normalizeOTPValueWithDetails(
      rawValue,
      props.length,
      props.validationType,
      props.normalizeValue,
    );

    if (didRejectCharacters) {
      reportValueInvalid(rawValue, createGenericEventDetails(REASONS.inputChange, event));
    }

    const committedValue = setValue(
      normalizedValue,
      createChangeEventDetails(REASONS.inputChange, event),
    );

    if (committedValue != null && committedValue !== '') {
      queueFocusInput(committedValue.length - 1, committedValue);
    }
  }

  void nextTick(writeValueToInputs);
}

// Some programs that fill a form send only `change`.
function handleHiddenChange(event: Event) {
  if ((event.currentTarget as HTMLInputElement).value !== handledHiddenValue) {
    handleHiddenInput(event);
  }
}

useFormReset(hiddenInputElement, (event) => {
  const committedValue =
    props.value === undefined
      ? setValue(props.defaultValue ?? '', createChangeEventDetails(REASONS.none, event))
      : null;

  if (committedValue != null) {
    isResetChangePending = true;
  } else {
    clearFieldError(otpValue.value);
  }
});

function setHiddenInput(input: unknown) {
  const next = input as HTMLInputElement | null;
  // Vue calls a function ref again on each patch, with the same element.
  if (next === hiddenInputElement.value) {
    return;
  }

  // A template can mount the root that replaces this root before it unmounts this root. This root
  // then clears the input of the field only when the input is its own.
  if (next !== null || validation.inputRef.value === hiddenInputElement.value) {
    validation.inputRef.value = next;
  }
  hiddenInputElement.value = next;
}

watch(
  hiddenInputElement,
  (hiddenInput, _previous, onCleanup) => {
    if (!hiddenInput) {
      return;
    }

    handledHiddenValue = hiddenInput.value;

    // A browser restores the form state of a page with no event on the inputs.
    onCleanup(addEventListener(ownerWindow(hiddenInput), 'pageshow', writeValueToInputs));
  },
  { flush: 'post' },
);

// Vue writes the value to the hidden input when the value changes. A program can then send a
// `change` event with the value that the input had before, and the root must handle it.
watch(
  otpValue,
  () => {
    handledHiddenValue = hiddenInputElement.value?.value;
  },
  { flush: 'post' },
);

// The style is the constant itself, in an object that no `mergeProps` call makes.
// `handleHiddenInputInvalid` then keeps the size that it writes.
function hiddenInputProps() {
  return {
    ...validation.getValidationProps(isDisabled.value),
    ref: setHiddenInput,
    type: 'text',
    id: controlId.value && inputName.value == null ? `${controlId.value}-hidden-input` : undefined,
    form: props.form,
    name: inputName.value,
    value: otpValue.value,
    autocomplete: props.autoComplete,
    inputmode: resolvedInputMode.value,
    minlength: props.length,
    maxlength: props.length,
    pattern: hiddenInputPattern.value,
    disabled: isDisabled.value,
    readonly: props.readOnly,
    required: props.required,
    'aria-hidden': true,
    tabindex: -1,
    style: inputName.value ? visuallyHiddenInput : visuallyHiddenInputPinned,
    onInvalid: handleHiddenInputInvalid,
    onFocusin() {
      focusInput(0);
    },
    onInput: handleHiddenInput,
    onChange: handleHiddenChange,
  };
}

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  <OTPFieldRootHiddenInput v-if="hasValidLength" :input-props="hiddenInputProps()" />
</template>
