<script lang="ts">
import type { HTMLAttributes, ShallowRef } from 'vue';
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
import { computed, inject, provide, shallowRef, useTemplateRef, watch } from 'vue';
import { mergeCleanups } from '../../common/mergeCleanups';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { useCompositeItem } from '../../internals/composite/root/useCompositeRoot';
import { useCheckedInput } from '../../internals/useCheckedInput';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '../../common/visuallyHidden';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useInputRegistration } from '../../internals/field-register-control';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { given } from '../../internals/givenAttributes';
import {
  useAriaLabelledBy,
  useControlLabelId,
  useLabelableContext,
  useLabelableId,
} from '../../internals/labelable-provider';
import { REASONS } from '../../internals/reasons';
import { serializeValue } from '../../internals/serializeValue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useFormReset } from '../../internals/useFormReset';
import { useFormRestore } from '../../internals/useFormRestore';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  RadioGroupContext,
  RadioRootContext,
  stateAttributesMapping,
} from '../../radio-group/radioContext';

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

const group: RadioGroupContext<Value> | undefined = inject(RadioGroupContext, undefined);
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

const inputElement: ShallowRef<HTMLInputElement | null> = useTemplateRef('input');

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

const { checkedProps, activate, onInputClick, onInputFocus, onInputInvalid, restoreInput } =
  useCheckedInput(inputElement, () => element.value, { checked, acceptClick });

// A radio must wait for the group to read its peers before a write unchecks one of them.
watch(
  inputElement,
  (input) => {
    if (input && group && input.checked !== input.defaultChecked) {
      group.takeInputsAfterMount();
    } else {
      restoreInput();
    }
  },
  { flush: 'post' },
);

if (group) {
  useFormReset(inputElement, group.reset);

  const { isHeld } = useInputRegistration(inputElement, (input) =>
    mergeCleanups(
      group.registerInput(input, {
        checked,
        restore: restoreInput,
        take(event) {
          if (!isDisabled.value && !isReadOnly.value && props.value !== undefined) {
            group.setCheckedValue(props.value, createChangeEventDetails(REASONS.none, event));
          }
        },
      }),
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
        group.refreshInput(input);
      }
    },
    { flush: 'post' },
  );
} else {
  useFormRestore(inputElement, restoreInput);
}

function acceptClick(_checked: boolean, event: MouseEvent) {
  if (checked.value) return true;
  if (isDisabled.value || isReadOnly.value || props.value === undefined) return false;

  const details = createChangeEventDetails(REASONS.none, event);
  group?.setCheckedValue(props.value, details);
  if (details.isCanceled) return false;

  setFieldTouched(true);
  return group !== undefined;
}

const state = computed<RadioRootState>(() => ({
  ...fieldState.value,
  required: isRequired.value,
  disabled: isDisabled.value,
  readOnly: isReadOnly.value,
  checked: checked.value,
}));

provide(RadioRootContext, state);

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const compositeItem = group
  ? useCompositeItem(element, { active: checked, disabled: isDisabled })
  : undefined;

const { elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  elementRef: element,
  button: (element) =>
    useButton(element, {
      disabled: isDisabled,
      native: () => props.nativeButton,
      // Space selects a radio on keyup even within a group.
      composite: false,
    }),
  state,
  stateAttributesMapping,
  props: (attrs) => [
    compositeItem?.attributes.value,
    compositeItem?.events,
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

        activate(event);
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
    getDescriptionProps,
    group && ((merged) => group.validation.getValidationProps(isDisabled.value, merged)),
  ],
});

defineExpose({ element, inputElement });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <input
    ref="input"
    type="radio"
    :name="group?.name.value"
    :form="group?.form.value"
    :required="isRequired"
    :readonly="isReadOnly"
    :style="group?.name.value ? visuallyHiddenInput : visuallyHiddenInputPinned"
    v-bind="checkedProps"
    :value="value === undefined ? undefined : serializeValue(value)"
    :id="hiddenInputId"
    :disabled="isDisabled"
    tabindex="-1"
    aria-hidden="true"
    @click="onInputClick"
    @focusin="onInputFocus"
    @invalid="onInputInvalid"
  />
</template>
