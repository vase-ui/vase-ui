<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type { REASONS } from '../../internals/reasons';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface FieldControlState extends FieldRootState {}

export type FieldControlChangeEventReason = typeof REASONS.none;

export type FieldControlChangeEventDetails =
  VaseUIChangeEventDetails<FieldControlChangeEventReason>;

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
// With it, `defineProps` gives the error TS2590.
interface FieldControlAutocomplete {
  autocomplete?: string | null | undefined;
}

export interface FieldControlProps
  extends
    VaseUIComponentProps<FieldControlState>,
    /* @vue-ignore */ Omit<
      WithVaseUIEvent<InputHTMLAttributes>,
      'autocomplete' | 'disabled' | 'id' | 'name' | 'value'
    >,
    /* @vue-ignore */ FieldControlAutocomplete {
  /**
   * The `id` of the input. The label of the field names the input with it.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   * The `name` prop on `<Field.Root>` takes precedence over this.
   */
  name?: string | undefined;
  /**
   * The value of the input. Use when controlled.
   */
  value?: string | number | readonly string[] | undefined;
  /**
   * The default value of the input. Use when uncontrolled.
   */
  defaultValue?: string | number | string[] | undefined;
  /**
   * Whether the component should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue';
import { useValueBeforeHydration } from '../../common/hydration';
import { useTimeout } from '../../common/useTimeout';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldInput, useRegisterFieldControl } from '../../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useFormContext } from '../../internals/form-context';
import {
  useDeferredServerRender,
  useLabelableContext,
  useLabelableId,
} from '../../internals/labelable-provider';
import { REASONS as REASON_VALUES } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useFormReset } from '../../internals/useFormReset';
import { useFormRestoreAsInput } from '../../internals/useFormRestore';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FieldControlProps>(), {
  as: 'input',
  disabled: false,
  value: undefined,
});

const emit = defineEmits<{
  /**
   * Callback fired when the `value` changes. Use when controlled.
   */
  valueChange: [value: string, eventDetails: FieldControlChangeEventDetails];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model:value` uses it.
   */
  'update:value': [value: string];
}>();

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, FieldControlState>;
}>();

const {
  state: fieldState,
  name: fieldName,
  disabled: fieldDisabled,
  setTouched,
  setDirty,
  validityData,
  setFilled,
  validationMode,
  validation,
} = useFieldRootContext();
const { clearErrors, elementRef: formElementRef, submitCountRef } = useFormContext();
const { labelId } = useLabelableContext();

// The control binds `aria-labelledby` and `aria-describedby`, and a label or a message can come
// after it.
useDeferredServerRender();

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(
  () => (fieldDisabled.value ?? false) || fieldsetDisabled.value || props.disabled,
);
const controlName = computed(() => fieldName.value ?? props.name);
const clearFieldError = useClearFieldError(controlName);
const state = computed<FieldControlState>(() => ({
  ...fieldState.value,
  disabled: isDisabled.value,
}));

const controlId = useLabelableId({ id: () => props.id, element: () => element.value });

// The DOM value is always a string, so the comparisons for `dirty` use the string.
const serializedValue = computed(() => (props.value == null ? undefined : String(props.value)));
const serializedDefaultValue = computed(() =>
  props.defaultValue == null ? undefined : String(props.defaultValue),
);
const releasedText = shallowRef<string>();
watch(serializedValue, (value, previous) => {
  if (value === undefined) {
    releasedText.value = previous;
  }
});

const writesValue = useValueBeforeHydration(props, () => element.value);

// Until the hydration ends, the input can hold text that the part did not handle yet. The field
// then takes the value of the props as the initial value, and the `input` event changes it.
useRegisterFieldControl(
  () => element.value,
  controlId,
  () => serializedValue.value,
  () =>
    writesValue.value
      ? (element.value as HTMLInputElement | null)?.value
      : (serializedValue.value ?? serializedDefaultValue.value ?? ''),
  () => !isDisabled.value,
  () => props.name,
);

// The value that the props give. The server HTML of the control and of each part after it then has
// `data-filled`.
const valueOfProps = serializedValue.value ?? serializedDefaultValue.value;
if (valueOfProps !== undefined) {
  setFilled(valueOfProps !== '');
}

// An uncontrolled input has no model to compare with a silent browser restore at pageshow.
let lastInputText: string | undefined;

function syncFilled() {
  const currentValue = serializedValue.value ?? (element.value as HTMLInputElement | null)?.value;
  if (currentValue !== undefined) {
    setFilled(currentValue !== '');
  }
  return currentValue;
}

onMounted(syncFilled);
watch(
  [serializedValue, serializedDefaultValue],
  ([value], [previous]) => {
    const text = syncFilled();
    if (value === undefined && previous !== undefined) {
      // The browser can sanitize the text. Compare pageshow with the value after Vue's patch.
      lastInputText = text;
    }
  },
  { flush: 'post' },
);

useValueChanged(serializedValue, () => {
  if (serializedValue.value === undefined) {
    return;
  }

  clearErrors(controlName.value);
  setDirty(serializedValue.value !== (validityData.value.initialValue ?? ''));

  validation.change(serializedValue.value);
});

const setFocused = useSetFieldFocused(isDisabled, () => element.value);
const enterValidationTimeout = useTimeout();

// A server needs the key `value` to write the `value` attribute. In a browser, Vue sets the DOM
// property `value` again on each render, and that replaces the text that the user typed. The DOM
// property `defaultValue` is the `value` attribute, and Vue sets it only when its value changes.
function valueProps():
  (Pick<FieldControlProps, 'value' | 'defaultValue'> & { '.value'?: string }) | undefined {
  if (props.value !== undefined) {
    return writesValue.value ? inputRender.valueProps() : undefined;
  }
  if (releasedText.value !== undefined && writesValue.value) {
    // Removing `value` clears the input. The property binding restores the text once, so later
    // renders leave native edits alone. The default still belongs to form.reset().
    return { '.value': releasedText.value, defaultValue: props.defaultValue ?? '' };
  }
  if (props.defaultValue === undefined) {
    return undefined;
  }
  // eslint-disable-next-line no-restricted-globals -- The part has no element before its first render, so `ownerDocument` does not apply. The check finds a server render and reads no DOM.
  return typeof document === 'undefined'
    ? { value: props.defaultValue }
    : { defaultValue: props.defaultValue };
}

function handleInput(event: Event) {
  const inputValue = (event.currentTarget as HTMLInputElement).value;
  const details = createChangeEventDetails(REASON_VALUES.none, event);
  emit('valueChange', inputValue, details);
  if (!details.isCanceled) {
    emit('update:value', inputValue);
  }

  // A controlled value comes from the `value` prop, so a value that the consumer refuses or
  // changes does not reach the state of the field.
  if (props.value !== undefined) {
    inputRender.renderValue();
    return;
  }

  lastInputText = inputValue;

  // `validation.change` reads `markedDirtyRef`, so `dirty` comes first.
  setDirty(inputValue !== (validityData.value.initialValue ?? ''));
  setFilled(inputValue !== '');

  if (!event.defaultPrevented && !details.isCanceled) {
    clearErrors(controlName.value);
    validation.change(inputValue);
  }
}

function handleFocusout(event: FocusEvent) {
  setTouched(true);
  setFocused(false);

  if (validationMode.value !== 'onBlur') {
    return;
  }

  const inputValue = (event.currentTarget as HTMLInputElement).value;
  validation.commit(inputValue);

  if (props.value !== undefined) {
    // A `focusout` listener of the consumer can change the controlled value before this microtask.
    // A value that goes back to the initial value is a reset by the program. The field then looks
    // unchanged, so a commit would only show a `valueMissing` error.
    queueMicrotask(() => {
      const nextValue = (element.value as HTMLInputElement | null)?.value;
      if (
        nextValue !== undefined &&
        nextValue !== inputValue &&
        nextValue !== (validityData.value.initialValue ?? '')
      ) {
        validation.commit(nextValue);
      }
    });
  }
}

function handleKeydown(event: KeyboardEvent) {
  const input = event.currentTarget as HTMLInputElement;
  if (input.tagName !== 'INPUT' || event.key !== 'Enter') {
    return;
  }

  setTouched(true);
  const form = input.form;
  if (form && form === formElementRef.value && !event.defaultPrevented) {
    const submitCount = submitCountRef.value;

    // The browser submits the form after `keydown`. This commit runs only when the form did not
    // validate the field first.
    enterValidationTimeout.start(0, () => {
      if (submitCountRef.value === submitCount) {
        validation.commit(input.value);
      }
    });
  } else {
    validation.commit(input.value);
  }
}

const giveFieldInput = useFieldInput();

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('input', props, {
  state,
  ref: giveFieldInput,
  props: (attrs) => [
    {
      id: controlId.value,
      disabled: isDisabled.value ? '' : undefined,
      name: controlName.value,
      'aria-labelledby': labelId.value,
      onInput: handleInput,
      onFocusin() {
        setFocused(true);
      },
      onFocusout: handleFocusout,
      onKeydown: handleKeydown,
    },
    valueProps(),
    attrs,
    (merged) => validation.getValidationProps(isDisabled.value, merged),
  ],
  stateAttributesMapping: fieldValidityMapping,
});

watch(
  [element, () => props.value !== undefined],
  () => {
    lastInputText = undefined;
  },
  { flush: 'sync' },
);

// A native reset of the form gives the control its default value and sends no `input` event.
useFormReset(element, () => {
  const value = (element.value as HTMLInputElement).value;
  lastInputText = undefined;
  setFilled(value !== '');
  setDirty(value !== (validityData.value.initialValue ?? ''));
  clearFieldError(value);
});

const inputRender = useFormRestoreAsInput(
  element,
  () => props.value,
  true,
  () => lastInputText,
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef" />
</template>
