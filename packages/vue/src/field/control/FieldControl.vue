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
  modelValue?: string | number | readonly string[] | undefined;
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
import { computed, onBeforeUpdate, onMounted, shallowRef, useAttrs, watch } from 'vue';
import { useValueBeforeHydration } from '../../common/hydration';
import { useTimeout } from '../../common/useTimeout';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldControl } from '../../internals/field-register-control';
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
  modelValue: undefined,
});

const emit = defineEmits<{
  /**
   * The control emits this event when the user edits its value.
   */
  valueChange: [value: string, eventDetails: FieldControlChangeEventDetails];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: string];
}>();

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, FieldControlState>;
}>();

const {
  state: fieldState,
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
const isDisabled = computed(() => fieldDisabled.value || fieldsetDisabled.value || props.disabled);
const state = computed<FieldControlState>(() => ({
  ...fieldState.value,
  disabled: isDisabled.value,
}));

const controlId = useLabelableId({ id: () => props.id, element: () => element.value });

const attrs = useAttrs();
// An outer part can supply the native value through `as`. Vue refreshes $attrs before each
// render, but it does not expose the attributes as reactive watch sources.
const nativeValue = shallowRef(attrs.value);
onBeforeUpdate(() => {
  nativeValue.value = attrs.value;
});
const suppliedValue = computed(() =>
  props.modelValue === undefined ? nativeValue.value : props.modelValue,
);

// The DOM value is always a string, so the comparisons for `dirty` use the string.
const serializedValue = computed(() =>
  suppliedValue.value == null ? undefined : String(suppliedValue.value),
);
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

// Later field parts read the filled state during the same server render.
const initial = serializedValue.value ?? serializedDefaultValue.value;
if (initial !== undefined) {
  setFilled(initial !== '');
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
function valueProps() {
  if (suppliedValue.value !== undefined) {
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
    emit('update:modelValue', inputValue);
  }

  // The field follows the value that its owner accepts, including a value the owner changes.
  if (suppliedValue.value !== undefined) {
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

  if (suppliedValue.value !== undefined) {
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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('input', props, {
  state,
  props: ({ value: _value, ...attrs }) => [
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
    attrs,
    valueProps(),
    (merged) => validation.getValidationProps(isDisabled.value, merged),
  ],
  stateAttributesMapping: fieldValidityMapping,
});

const { name: controlName } = useFieldControl(element, {
  input: element,
  id: controlId,
  name: () => props.name,
  value: serializedValue,
  // Hydration adopts native edits after the field captures its initial value.
  getValue: () =>
    writesValue.value
      ? (element.value as HTMLInputElement | null)?.value
      : (serializedValue.value ?? serializedDefaultValue.value ?? ''),
  enabled: () => !isDisabled.value,
});
const clearFieldError = useClearFieldError(controlName);

watch(
  [element, () => suppliedValue.value !== undefined],
  () => {
    lastInputText = undefined;
  },
);

// A native reset of the form gives the control its default value and sends no `input` event.
useFormReset(element, () => {
  const value = (element.value as HTMLInputElement).value;
  lastInputText = undefined;
  setFilled(value !== '');
  setDirty(value !== (validityData.value.initialValue ?? ''));
  clearFieldError(value);
});

const inputRender: ReturnType<typeof useFormRestoreAsInput<unknown>> = useFormRestoreAsInput(
  element,
  () => suppliedValue.value,
  true,
  () => lastInputText,
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef" />
</template>
