<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type {
  NonNativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface RadioRootState extends FieldRootState {
  /**
   * Whether the radio button is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly: boolean;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: boolean;
  /**
   * Whether the radio button has been touched (when wrapped in Field.Root).
   */
  touched: boolean;
  /**
   * Whether the radio button's value has changed from its initial value (when wrapped in Field.Root).
   */
  dirty: boolean;
  /**
   * Whether the radio button is in a valid state (when wrapped in Field.Root).
   */
  valid: boolean | null;
  /**
   * Whether the radio button has a value (when wrapped in Field.Root).
   */
  filled: boolean;
  /**
   * Whether the radio button is focused (when wrapped in Field.Root).
   */
  focused: boolean;
}

export interface RadioRootProps<Value = any>
  extends
    NonNativeButtonProps,
    VaseUIComponentProps<RadioRootState>,
    /* @vue-ignore */ Omit<
      WithVaseUIEvent<HTMLAttributes, 'aria-label' | 'aria-labelledby'>,
      'id'
    > {
  /**
   * The unique identifying value of the radio in a group.
   */
  value: Value;
  /**
   * The id of the hidden input element.
   *
   * When `nativeButton` is `true`, the id is applied to the root element.
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly?: boolean | undefined;
  /**
   * The accessible name of the radio. With a name here, no label names the radio.
   */
  ariaLabel?: string | undefined;
  /**
   * The ids of the elements that name the radio. They replace the label of the radio.
   */
  ariaLabelledby?: string | undefined;
}
</script>

<script setup lang="ts" generic="Value = any">
import { computed, nextTick, provide, shallowRef, watch } from 'vue';
import { mergeCleanups } from '../../common/mergeCleanups';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../common/visuallyHidden';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useInputRegistration } from '../../internals/field-register-control';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { forwardClickToInput } from '../../internals/forwardClickToInput';
import { given } from '../../internals/givenAttributes';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import {
  useAriaLabelledBy,
  useControlLabelId,
  useLabelableContext,
  useLabelableId,
} from '../../internals/labelable-provider';
import { REASONS } from '../../internals/reasons';
import { serializeValue } from '../../internals/serializeValue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useFormReset } from '../../internals/useFormReset';
import { useFormRestore } from '../../internals/useFormRestore';
import { useRenderElement } from '../../internals/useRenderElement';
import { useRadioGroupContext } from '../../radio-group/RadioGroupContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { RadioRootContext } from './RadioRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RadioRootProps<Value>>(), {
  as: 'span',
  disabled: false,
  nativeButton: false,
  readOnly: false,
  required: false,
});

defineSlots<{
  default(props: { state: RadioRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, RadioRootState>;
}>();

const group = useRadioGroupContext<Value>();
const {
  setTouched: setFieldTouched,
  setFilled,
  state: fieldState,
  disabled: fieldDisabled,
} = useFieldRootContext();
const fieldItem = useFieldItemContext();
const { getDescriptionProps } = useLabelableContext();

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(
  () =>
    fieldDisabled.value ||
    fieldItem.disabled.value ||
    (group?.disabled.value ?? false) ||
    fieldsetDisabled.value ||
    props.disabled,
);
const isReadOnly = computed(() => (group?.readOnly.value ?? false) || props.readOnly);
const isRequired = computed(() => (group?.required.value ?? false) || props.required);
const checked = computed(() =>
  group ? group.checkedValue.value === props.value : props.value === '',
);

const inputElement = shallowRef<HTMLInputElement | null>(null);

function setInputElement(value: unknown) {
  inputElement.value = value as HTMLInputElement | null;
}

const setFocused = useSetFieldFocused(isDisabled, () => element.value);

// A radio in a group leaves the first `filled` state to the group. A server runs the `setup` of
// the radio after it wrote the parts that come after the group.
if (!group && checked.value) {
  setFilled(true);
}

const rootId = useVaseUiId();
const controlId = useLabelableId({
  id: () => props.id,
  element: () => (props.nativeButton ? element.value : null),
});
const hiddenInputId = computed(() => (props.nativeButton ? undefined : controlId.value));

const ariaLabelledBy = useAriaLabelledBy(
  () => props.ariaLabelledby,
  useControlLabelId(),
  inputElement,
  () => !props.nativeButton,
  hiddenInputId,
  () => props.ariaLabel,
);

// The part sets `composite` to `false`, so the Space key selects a radio on keyup in a group too.
const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
  native: () => props.nativeButton,
  composite: false,
});

// Vue writes `checked` to the input only when the value changes between two renders, and
// hydration does not write it. A browser checks the input of a click that the parent does not
// accept. A form would then submit a state that the radio does not show.
function writeCheckedToInput() {
  const input = inputElement.value;
  if (input && input.checked !== checked.value) {
    input.checked = checked.value;
  }
}

// Vue writes `checked` to the attribute too, so only an input that changed before the hydration
// differs from its `defaultChecked`. The group then takes its inputs one time, and the radio writes
// nothing before that take.
watch(
  inputElement,
  (input) => {
    if (!input) {
      return;
    }

    if (group && input.checked !== input.defaultChecked) {
      group.takeInputsAfterMount();
    } else {
      writeCheckedToInput();
    }
  },
  { flush: 'post' },
);

if (group) {
  // A click checks the input and unchecks the other inputs of a group that has a name. A parent
  // that controls the group can keep the old value, and then no radio renders again.
  watch(group.inputSyncRequest, writeCheckedToInput, { flush: 'post' });

  // Only the input that the browser checked gives its value to the group. Each radio writes its
  // state in the next tick: a write in this tick can uncheck the input that the browser checked,
  // before its radio reads it.
  watch(
    group.inputTakeRequest,
    (request) => {
      const input = inputElement.value;
      if (!request || !input || input.checked === checked.value) {
        return;
      }

      if (input.checked && !isDisabled.value && !isReadOnly.value && props.value !== undefined) {
        group.setCheckedValue(props.value, createChangeEventDetails(REASONS.none, request.event));
      }

      void nextTick(writeCheckedToInput);
    },
    { flush: 'post' },
  );

  // The radio follows the reset with its own input. The input that the group exposes changes with
  // the value and can be absent.
  useFormReset(inputElement, group.reset);

  const { isHeld } = useInputRegistration(inputElement, (input) =>
    mergeCleanups(
      group.registerInputRef(input),
      group.validation.registerInput(input, {
        controlRef: () => element.value,
        value: undefined,
      }) || undefined,
    ),
  );

  // The registration of an input whose `disabled` property is `false` ends the `null` after an
  // unmount. A `computed` that reads `inputElement` also follows each change of `checked` and
  // `disabled`.
  watch(
    [checked, isDisabled],
    () => {
      const input = inputElement.value;
      if (input && !isHeld.value) {
        group.registerInputRef(input);
      }
    },
    { flush: 'post' },
  );
}

function onInputClick(event: MouseEvent) {
  // The root dispatches this click for its own click and for a focus that an arrow key moved. The
  // ancestors already got the click of the user.
  event.stopPropagation();

  // The browser puts the old state back after a click whose default action is prevented.
  if (event.defaultPrevented) {
    return;
  }

  // React calls `onChange` of a radio input only for a click that checks it.
  if (checked.value) {
    return;
  }

  if (isDisabled.value || isReadOnly.value || props.value === undefined) {
    event.preventDefault();
    return;
  }

  const details = createChangeEventDetails(REASONS.none, event);

  group?.setCheckedValue(props.value, details);

  if (details.isCanceled) {
    event.preventDefault();
    return;
  }

  setFieldTouched(true);

  // A radio with no group has no state to change, so its input goes back to its state.
  if (!group) {
    event.preventDefault();
  }
}

// A radio with no group has no state to change, so it writes its state over a restored input.
if (!group) {
  useFormRestore(inputElement, writeCheckedToInput);
}

const state = computed<RadioRootState>(() => ({
  ...fieldState.value,
  required: isRequired.value,
  disabled: isDisabled.value,
  readOnly: isReadOnly.value,
  checked: checked.value,
}));

provide(RadioRootContext, state);

// Only a radio in a group is an item of a composite, and `useCompositeItem` throws with no
// composite root. The context of a component does not change, so `setup` makes this choice one
// time.
const item = group ? useCompositeItem({ active: checked, disabled: isDisabled }) : undefined;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  state,
  ref: item ? [item.compositeRef, buttonRef] : [buttonRef],
  stateAttributesMapping,
  props: (attrs) => [
    item?.compositeProps.value,
    {
      id: props.nativeButton ? controlId.value : rootId.value,
      role: 'radio',
      'aria-checked': checked.value,
      'aria-label': given('aria-label', props.ariaLabel),
      'aria-labelledby': ariaLabelledBy.value,
      // Only a fully disabled group leaves the tab order. A single disabled radio keeps the
      // composite tab index.
      ...(group?.disabled.value && { tabindex: -1 }),
      onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
          // A radio activates with Space only. A prevented keydown stops `useButton` from turning
          // Enter into a click.
          event.preventDefault();
        }
      },
      onClick(event: MouseEvent) {
        if (event.defaultPrevented || isDisabled.value || isReadOnly.value) {
          return;
        }

        event.preventDefault();

        forwardClickToInput(inputElement.value, event);
      },
      onFocusin(event: FocusEvent) {
        setFocused(true);

        // After an arrow key, the radio that gets focus selects itself.
        if (
          event.defaultPrevented ||
          isDisabled.value ||
          isReadOnly.value ||
          !group?.touched.value
        ) {
          return;
        }

        inputElement.value?.click();
        group.setTouched(false);
      },
      onFocusout() {
        // The `contains` check of the group clears the focus when it leaves the group, so a move
        // from one radio to another does not change the focused state.
        if (!group) {
          setFocused(false);
        }
      },
    },
    attrs,
    getButtonProps,
    getDescriptionProps,
    group && ((merged) => group.validation.getValidationProps(isDisabled.value, merged)),
  ],
});

function inputProps() {
  return {
    type: 'radio',
    form: group?.form.value,
    id: hiddenInputId.value,
    name: group?.name.value,
    tabindex: -1,
    style: group?.name.value ? visuallyHiddenInput : visuallyHiddenInputPinned,
    onInvalid: handleHiddenInputInvalid,
    'aria-hidden': true,
    ...(props.value !== undefined ? { value: serializeValue(props.value) } : undefined),
    disabled: isDisabled.value,
    checked: checked.value,
    required: isRequired.value,
    readonly: isReadOnly.value,
    onClick: onInputClick,
    onFocusin() {
      element.value?.focus();
    },
  };
}

defineExpose({ element, inputElement });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <input v-bind="inputProps()" :ref="setInputElement" />
</template>
