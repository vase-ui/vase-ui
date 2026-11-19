<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  nextTick,
  provide,
  ref,
  shallowReactive,
  shallowRef,
  useAttrs,
  useId,
  watch,
} from 'vue';
import { byDocumentOrder, useElement } from '../common/element';
import { sameValue } from '../common/values';
import { useInDisabledFieldset } from '../fieldset/part';
import { formKey, type FormField } from '../form/field';
import { fieldKey, fieldStateAttributes, type FieldControl, type NativeControl } from './control';
import { fieldPartsKey, joinIds, type FieldLabel } from './root';
import type { FieldRootProps, FieldRootState, FieldValidateResult, FieldValidity } from './types';

type Failures = Omit<FieldValidity, 'valid'>;
interface Result {
  failures: Failures;
  errors: string[];
  /** The errors came from `validate`. */
  ofValidate: boolean;
}

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FieldRootProps>(), {
  validationDebounceTime: 0,
  // An absent `dirty` or `touched` lets the field own that state.
  dirty: undefined,
  touched: undefined,
});
const emit = defineEmits<{
  'update:dirty': [dirty: boolean];
  'update:touched': [touched: boolean];
}>();
defineSlots<{
  default?(scope: {
    state: FieldRootState;
    validity: FieldValidity;
    errors: string[];
    value: unknown;
    initialValue: unknown;
  }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: FieldRootState;
  }): unknown;
}>();

const noFailures: Failures = {
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valueMissing: false,
};
const passed: Result = { failures: noFailures, errors: [], ofValidate: false };

const attrs = useAttrs();
const form = inject(formKey, null);
const controlId = useId();
const { element, setElement } = useElement<HTMLDivElement>();

// A swap of controls removes the old one before the new one registers.
const control = shallowRef<FieldControl>();
const describers = shallowReactive<{ readonly id: string; readonly shown: boolean }[]>([]);
const labels = shallowReactive<FieldLabel[]>([]);

const value = shallowRef<unknown>();
const filled = ref(false);
const firstValue = shallowRef<unknown>();
let hasValue = false;
const ownTouched = ref(false);
const result = shallowRef<Result | null>(null);
// The required rule: `valueMissing` counts after the field was dirty, a submit, or `validate()`.
let valueMissingCounts = false;
// The number of the last validation. The result of an earlier one changes nothing.
let validation = 0;
// The timer of a validation that waits.
let waiting: ReturnType<typeof setTimeout> | undefined;
// The input that has the message of `validate`.
let messageInput: NativeControl | undefined;

const name = computed(() => props.name ?? control.value?.name);
const inDisabledFieldset = useInDisabledFieldset(element);
const disabled = computed(() => props.disabled || inDisabledFieldset.value);
// The browser bars a disabled or read-only element from constraint validation.
const barred = computed(
  () => disabled.value || !!control.value?.disabled || !!control.value?.readOnly,
);
const mode = computed(() => props.validationMode ?? form?.validationMode ?? 'submit');
const validatesOnChange = computed(
  () => mode.value === 'change' || (mode.value === 'submit' && !!form?.submitted),
);
const formErrors = computed(() => {
  const errors = form?.errors;
  if (!name.value || !errors) return [];
  // The read of the key comes first: Vue tracks it, and it does not track `Object.hasOwn`.
  const messages = errors[name.value];
  if (!Object.hasOwn(errors, name.value)) return [];
  return [messages].flat().filter((error): error is string => !!error);
});

const foundDirty = computed(() => !sameValue(value.value, firstValue.value));
const valid = computed(() => {
  if (barred.value) return null;
  if (props.invalid || formErrors.value.length > 0) return false;
  return result.value && result.value.errors.length === 0;
});
const state = computed<FieldRootState>(() => ({
  disabled: disabled.value,
  touched: props.touched ?? ownTouched.value,
  dirty: props.dirty ?? foundDirty.value,
  valid: valid.value,
  filled: filled.value,
}));
const validity = computed<FieldValidity>(() => ({
  ...(barred.value ? noFailures : (result.value?.failures ?? noFailures)),
  valid: valid.value,
}));
const errors = computed(() => (barred.value ? [] : (result.value?.errors ?? [])));
const describedBy = computed(() => joinIds(describers));
// A `<label for>` names only a labelable element, and the browser gives such an element `labels`.
const labelable = computed(() => !control.value || 'labels' in control.value.element);

watch(foundDirty, (dirty) => {
  if (dirty) valueMissingCounts = true;
  emit('update:dirty', dirty);
});

const formField: FormField = {
  get name() {
    return name.value;
  },
  get element() {
    return control.value?.focusElement ?? validationInput();
  },
  get value() {
    return control.value?.formValue ? control.value.formValue() : value.value;
  },
  get disabled() {
    return disabled.value || !!control.value?.disabled;
  },
  validate: validateAtOnce,
  get invalid() {
    return valid.value === false;
  },
};

provide(fieldKey, {
  get disabled() {
    return disabled.value;
  },
  get name() {
    return name.value;
  },
  controlId,
  get labelId() {
    return labels[0]?.id;
  },
  get labelledBy() {
    if (!labelable.value) return undefined;
    return joinIds(labels.filter((label) => !label.native));
  },
  get describedBy() {
    return describedBy.value;
  },
  get state() {
    return state.value;
  },
  setControl(added) {
    control.value = added;
    return () => {
      control.value = undefined;
      dropValidation();
    };
  },
  setValue(next, nextFilled) {
    filled.value = nextFilled;
    if (!hasValue) {
      hasValue = true;
      firstValue.value = next;
      value.value = next;
      return;
    }
    if (sameValue(next, value.value)) return;
    value.value = next;
    if (validatesOnChange.value) validateAfterChange();
  },
  onEdit,
  onLeave(left) {
    // Chromium sends `blur` when Vue removes a focused control, and Firefox and WebKit do not. Each
    // browser sends `blur` when a focused control becomes disabled or loses its box. The user left
    // the control only when it is still in the document, enabled and shown.
    queueMicrotask(() => {
      if (!left.isConnected || left.matches(':disabled') || left.getClientRects().length === 0) {
        return;
      }
      if (!state.value.touched) emit('update:touched', true);
      ownTouched.value = true;
      if (mode.value === 'blur') {
        // The field validates with the value that the blur listeners of the developer gave, after
        // the render of their change.
        clearTimeout(waiting);
        waiting = setTimeout(validateNow);
      }
    });
  },
  onReset(next) {
    dropValidation();
    value.value = next;
    if (state.value.touched) emit('update:touched', false);
    ownTouched.value = false;
    result.value = null;
    valueMissingCounts = false;
    removeMessages();
  },
});

// The browser lists the inputs of the control in `form.elements`, and the form finds the field
// through them.
watch(
  () => control.value?.inputs,
  (inputs) => {
    for (const input of inputs ?? []) form?.addControl(input, formField);
  },
);

provide(fieldPartsKey, {
  get state() {
    return state.value;
  },
  get controlId() {
    if (!control.value) return controlId;
    return labelable.value ? control.value.id : undefined;
  },
  get validity() {
    return validity.value;
  },
  get errors() {
    return errors.value;
  },
  get formErrors() {
    return formErrors.value;
  },
  addDescriber(describer) {
    describers.push(describer);
    return () => describers.splice(describers.indexOf(describer), 1);
  },
  addLabel(label) {
    labels.push(label);
    return () => labels.splice(labels.indexOf(label), 1);
  },
  focusControl() {
    if (labelable.value) control.value?.element.focus();
  },
});

defineExpose({ element, validate: validateAtOnce });

function elementProps() {
  return mergeProps(fieldStateAttributes(state.value, disabled.value), attrs);
}

function dropValidation() {
  validation++;
  clearTimeout(waiting);
}

function validateAfterChange() {
  dropValidation();
  if (props.validationDebounceTime > 0) {
    waiting = setTimeout(validateNow, props.validationDebounceTime);
  } else {
    // The element shows the new value after the next render.
    nextTick(validateNow);
  }
}

function validateAtOnce() {
  valueMissingCounts = true;
  validateNow();
}

function validateNow() {
  dropValidation();
  const current = validation;
  if (barred.value) return;
  // The native check does not count the message of `validate`.
  removeMessages();
  const el = validationInput();
  if (el) {
    const failed = nativeFailure(el);
    if (failed) {
      result.value = failed;
      return;
    }
  }
  const output = props.validate?.(value.value, form?.values() ?? {});
  if (output instanceof Promise) {
    // Outside `submit` mode, an error of `validate` stays until the new result arrives.
    if (mode.value === 'submit' || !result.value?.ofValidate) result.value = null;
    output.then(
      (resolved) => {
        if (current === validation) applyResult(resolved);
      },
      () => {},
    );
  } else {
    applyResult(output);
  }
}

function nativeFailure(el: NativeControl): Result | null {
  if (el.validity.valid) return null;
  const failures = failuresOf(el);
  if (onlyValueMissing(failures) && !valueMissingCounts) return null;
  return { failures, errors: [el.validationMessage], ofValidate: false };
}

function failuresOf(el: NativeControl) {
  const failures = { ...noFailures };
  for (const key of Object.keys(noFailures) as (keyof Failures)[]) failures[key] = el.validity[key];
  return failures;
}

function onlyValueMissing(failures: Failures) {
  return failures.valueMissing && Object.values(failures).filter(Boolean).length === 1;
}

function applyResult(output: FieldValidateResult) {
  const messages = [output ?? []].flat().filter((message): message is string => !!message);
  if (messages.length === 0) {
    result.value = passed;
    return;
  }
  messageInput = validationInput();
  messageInput?.setCustomValidity(messages.join('\n').replaceAll('\r\n', '\n'));
  result.value = {
    failures: { ...noFailures, customError: true },
    errors: messages,
    ofValidate: true,
  };
}

/**
 * The input whose constraint validation stands for the control: the first one in the document
 * that fails, or else the first one. A disabled input does not count.
 */
function validationInput() {
  const inputs = (control.value?.inputs ?? []).filter((input) => input.willValidate);
  inputs.sort(byDocumentOrder);
  return inputs.find((input) => !input.validity.valid) ?? inputs[0];
}

// A control can set a custom validity of its own, such as the partial entry of a date field. The
// field removes only the message of `validate`.
function removeMessages() {
  messageInput?.setCustomValidity('');
  messageInput = undefined;
}

function onEdit() {
  form?.onEdit(name.value);
  // An invalid field that does not validate at each change takes back only `valueMissing`.
  if (validatesOnChange.value || valid.value !== false) return;
  removeMessages();
  const el = validationInput();
  if (!el) return;
  dropValidation();
  const failures = failuresOf(el);
  if (!failures.valueMissing) {
    result.value = passed;
  } else if (onlyValueMissing(failures)) {
    result.value = { failures, errors: [el.validationMessage], ofValidate: false };
  }
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot
      :state="state"
      :validity="validity"
      :errors="errors"
      :value="value"
      :initialValue="firstValue"
    />
  </div>
</template>
