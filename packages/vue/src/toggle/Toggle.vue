<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createVaseUIEventDetails';
import { REASONS } from '../internals/reasons';
import type { NativeButtonProps, VaseUIComponentProps, WithVaseUIEvent } from '../internals/types';

export interface ToggleState {
  /**
   * Whether the toggle is currently pressed.
   */
  pressed: boolean;
  /**
   * Whether the toggle should ignore user interaction.
   */
  disabled: boolean;
}

export interface ToggleProps<Value extends string = string>
  extends
    NativeButtonProps,
    VaseUIComponentProps<ToggleState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled' | 'value'> {
  /**
   * Whether the toggle button is currently pressed.
   * This is the controlled counterpart of `defaultPressed`.
   */
  modelValue?: boolean | undefined;
  /**
   * Whether the toggle button is currently pressed.
   * This is the uncontrolled counterpart of `modelValue`.
   * @default false
   */
  defaultPressed?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A unique string that identifies the toggle when used
   * inside a toggle group.
   */
  value?: Value | undefined;
}

export type ToggleChangeEventReason = typeof REASONS.none;

export type ToggleChangeEventDetails = VaseUIChangeEventDetails<ToggleChangeEventReason>;
</script>

<script setup lang="ts">
import { computed, shallowRef, watchPostEffect, type ShallowRef } from 'vue';
import { error } from '../common/error';
import { useControlled } from '../common/useControlled';
import { useInDisabledFieldset } from '../fieldset/part';
import { useCompositeItem } from '../internals/composite/root/useCompositeRoot';
import { createChangeEventDetails } from '../internals/createVaseUIEventDetails';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useButton } from '../internals/use-button/useButton';
import { useVaseUiId } from '../internals/useVaseUiId';
import { useCastBooleanWarning } from '../internals/useCastBooleanWarning';
import { useRenderElement } from '../internals/useRenderElement';
import { useToggleGroupContext } from '../toggle-group/ToggleGroup.vue';
import type { ToolbarRootItemMetadata } from '../toolbar/root/ToolbarRoot.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToggleProps>(), {
  as: 'button',
  modelValue: undefined,
  defaultPressed: false,
  disabled: false,
  nativeButton: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Toggle');
}

const emit = defineEmits<{
  /**
   * Callback fired when the pressed state is changed.
   */
  pressedChange: [pressed: boolean, eventDetails: ToggleChangeEventDetails];
  /**
   * Event handler called after `pressedChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [pressed: boolean];
}>();

defineSlots<{
  default(props: { state: ToggleState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToggleState>;
}>();

// `|| undefined` gives a generated value to a toggle whose `value` is the empty string.
const groupItemValue = useVaseUiId(() => props.value || undefined);
const groupContext = useToggleGroupContext<string>();

const fieldsetDisabled = useInDisabledFieldset(() => element.value);
const toggleDisabled = computed(
  () =>
    props.disabled ||
    (groupContext?.disabled.value ?? false) ||
    (props.nativeButton && fieldsetDisabled.value),
);

if (process.env.NODE_ENV !== 'production' && groupContext) {
  watchPostEffect(() => {
    if (props.value === undefined && groupContext.isValueInitialized.value) {
      error(
        'A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop.',
        'This will cause issues between the Toggle Group and Toggle values.',
        'Give `<Toggle>` a `value` of the same type as an item in the `<ToggleGroup>` model.',
      );
    }
  });
}

const isPressed = useControlled({
  controlled: () =>
    groupContext ? groupContext.value.value.includes(groupItemValue.value) : props.modelValue,
  default: () => props.defaultPressed,
  name: 'Toggle',
  state: 'pressed',
});

const state = computed<ToggleState>(() => ({
  disabled: toggleDisabled.value,
  pressed: isPressed.value,
}));

function onClick(event: MouseEvent) {
  const nextPressed = !isPressed.value;
  const details = createChangeEventDetails(REASONS.none, event);

  // `pressedChange` comes before the group commits its value. The group gets the same
  // `details` object, so a `cancel()` here also stops the change of the group value.
  emit('pressedChange', nextPressed, details);

  if (details.isCanceled) {
    return;
  }

  groupContext?.setGroupValue(groupItemValue.value, nextPressed, details);

  if (details.isCanceled) {
    return;
  }

  emit('update:modelValue', nextPressed);
  isPressed.value = nextPressed;
}

// A disabled toggle cannot hold the roving focus. The toolbar makes its `disabledIndices` from
// this metadata. A toggle that is not a native button has no `disabled` attribute, so only the
// metadata tells the toolbar.
const itemMetadata = computed<ToolbarRootItemMetadata>(() => ({
  disabled: toggleDisabled.value,
  focusableWhenDisabled: false,
}));

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const compositeItem = groupContext
  ? useCompositeItem(element, { metadata: itemMetadata, disabled: toggleDisabled })
  : undefined;

const { elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  elementRef: element,
  button: (element) =>
    useButton(element, {
      disabled: toggleDisabled,
      native: () => props.nativeButton,
    }),
  state,
  props: (attrs) => {
    // A toggle is never a submit button and never a part of a form.
    const { form, type, ...elementAttrs } = attrs;
    return [
      compositeItem?.attributes.value,
      compositeItem?.events,
      { 'aria-pressed': isPressed.value, onClick },
      elementAttrs,
    ];
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
