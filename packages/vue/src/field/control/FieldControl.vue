<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
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
  autocomplete?: string | undefined;
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
import { computed, nextTick, onMounted, watch } from 'vue';
import { useTimeout } from '../../common/useTimeout';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useRegisterFieldControl } from '../../internals/field-register-control';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useFormContext } from '../../internals/form-context';
import { useLabelableContext, useLabelableId } from '../../internals/labelable-provider';
import { REASONS as REASON_VALUES } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
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

const isDisabled = computed(() => (fieldDisabled.value ?? false) || props.disabled);
const controlName = computed(() => fieldName.value ?? props.name);
const state = computed<FieldControlState>(() => ({
  ...fieldState.value,
  disabled: isDisabled.value,
}));

const controlId = useLabelableId({ id: () => props.id });

// The DOM value is always a string, so the comparisons for `dirty` use the string.
const serializedValue = computed(() => (props.value == null ? undefined : String(props.value)));
const serializedDefaultValue = computed(() =>
  props.defaultValue == null ? undefined : String(props.defaultValue),
);

useRegisterFieldControl(
  () => element.value,
  controlId,
  () => serializedValue.value,
  () => (element.value as HTMLInputElement | null)?.value,
  () => !isDisabled.value,
  () => props.name,
);

// The value that the props give. The server HTML of the control and of each part after it then has
// `data-filled`.
const valueOfProps = serializedValue.value ?? serializedDefaultValue.value;
if (valueOfProps !== undefined) {
  setFilled(valueOfProps !== '');
}

// The value that the input has after the last event that the part handled. A write of Vue, of the
// part or of a reset sets it too.
let handledValue: string | undefined;

function syncFilled() {
  const currentValue = serializedValue.value ?? (element.value as HTMLInputElement | null)?.value;
  if (currentValue !== undefined) {
    setFilled(currentValue !== '');
  }
}

function syncAfterWrite() {
  handledValue = (element.value as HTMLInputElement | null)?.value;
  syncFilled();
}

onMounted(syncAfterWrite);
watch([serializedValue, serializedDefaultValue], syncAfterWrite, { flush: 'post' });

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
const resetTimeout = useTimeout();

// A server needs the key `value` to write the `value` attribute. In a browser, Vue sets the DOM
// property `value` again on each render, and that replaces the text that the user typed. The DOM
// property `defaultValue` is the `value` attribute, and Vue sets it only when its value changes.
function valueProps() {
  if (props.value !== undefined) {
    return { value: props.value };
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
  const input = event.currentTarget as HTMLInputElement;
  const inputValue = input.value;
  handledValue = inputValue;
  const details = createChangeEventDetails(REASON_VALUES.none, event);
  emit('valueChange', inputValue, details);
  if (!details.isCanceled) {
    emit('update:value', inputValue);
  }

  // A controlled value comes from the `value` prop, so a value that the consumer refuses or
  // changes does not reach the state of the field.
  if (props.value !== undefined) {
    // Vue writes the DOM value only when the part renders. The part does not render when the
    // consumer keeps its value.
    nextTick(() => {
      const expectedValue = serializedValue.value;
      if (expectedValue !== undefined && input.value !== expectedValue) {
        input.value = expectedValue;
      }
      handledValue = input.value;
    });
    return;
  }

  // `validation.change` reads `markedDirtyRef`, so `dirty` comes first.
  setDirty(inputValue !== (validityData.value.initialValue ?? ''));
  setFilled(inputValue !== '');

  if (!event.defaultPrevented && !details.isCanceled) {
    clearErrors(controlName.value);
    validation.change(inputValue);
  }
}

// React calls `onChange` of a text input for an `input` event and for a `change` event, when the
// value is new. Some programs that fill a form send only `change`.
function handleChange(event: Event) {
  if ((event.currentTarget as HTMLInputElement).value !== handledValue) {
    handleInput(event);
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

// A template can mount the control that replaces this control before it unmounts this control.
// The control then clears the input of the field only when the input is its own.
let ownInput: HTMLInputElement | null = null;
function setInput(next: HTMLElement | null) {
  const input = next as HTMLInputElement | null;
  if (input !== null || validation.inputRef.value === ownInput) {
    validation.inputRef.value = input;
  }
  ownInput = input;
}

const { element, elementProps } = useRenderElement('input', props, {
  state,
  ref: setInput,
  props: (attrs) => [
    {
      id: controlId.value,
      disabled: isDisabled.value ? '' : undefined,
      name: controlName.value,
      'aria-labelledby': labelId.value,
      onInput: handleInput,
      onChange: handleChange,
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

// A native reset of the form gives the control its default value and sends no `input` event.
// The event does not leave a shadow root, so the listener is on the root node of the control.
// The getter of a `watch` runs when Vue makes the watcher, so this `watch` comes after `element`.
watch(
  element,
  (input, _previous, onCleanup) => {
    if (!input) {
      return;
    }
    const root = input.getRootNode();
    const handleReset = (event: Event) => {
      const form = (input as HTMLInputElement).form;
      if (!form || event.target !== form) {
        return;
      }
      // The browser resets the controls after the listeners of the event.
      resetTimeout.start(0, () => {
        if (event.defaultPrevented) {
          return;
        }
        const value = (input as HTMLInputElement).value;
        handledValue = value;
        setFilled(value !== '');
        setDirty(value !== (validityData.value.initialValue ?? ''));
      });
    };
    root.addEventListener('reset', handleReset);
    onCleanup(() => {
      resetTimeout.clear();
      root.removeEventListener('reset', handleReset);
    });
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" />
</template>
