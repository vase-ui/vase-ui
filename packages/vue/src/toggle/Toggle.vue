<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
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
  pressed?: boolean | undefined;
  /**
   * Whether the toggle button is currently pressed.
   * This is the uncontrolled counterpart of `pressed`.
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
import { computed, onMounted, watch } from 'vue';
import { error } from '../common/error';
import { useControlled } from '../common/useControlled';
import { useCompositeItem } from '../internals/composite/item/useCompositeItem';
import { createChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useButton } from '../internals/use-button';
import { useVaseUiId } from '../internals/useBaseUiId';
import { useRenderElement } from '../internals/useRenderElement';
import { useToggleGroupContext } from '../toggle-group/ToggleGroupContext';
import type { ToolbarRootItemMetadata } from '../toolbar/root/ToolbarRoot.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToggleProps>(), {
  as: 'button',
  pressed: undefined,
  defaultPressed: false,
  disabled: false,
  nativeButton: true,
});

const emit = defineEmits<{
  /**
   * Callback fired when the pressed state is changed.
   */
  pressedChange: [pressed: boolean, eventDetails: ToggleChangeEventDetails];
  'update:pressed': [pressed: boolean];
}>();

defineSlots<{
  default(props: { state: ToggleState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToggleState>;
}>();

// `|| undefined` gives a generated value to a toggle whose `value` is the empty string.
const groupItemValue = useVaseUiId(() => props.value || undefined);
const groupContext = useToggleGroupContext<string>();

const toggleDisabled = computed(() => props.disabled || (groupContext?.disabled.value ?? false));

if (process.env.NODE_ENV !== 'production' && groupContext) {
  const checkValue = () => {
    if (props.value === undefined && groupContext.isValueInitialized.value) {
      error(
        'A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop.',
        'This will cause issues between the Toggle Group and Toggle values.',
        'Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
      );
    }
  };
  onMounted(checkValue);
  watch([() => props.value, groupContext.isValueInitialized], checkValue);
}

const [isPressed, setPressedState] = useControlled({
  controlled: () =>
    groupContext ? groupContext.value.value.indexOf(groupItemValue.value) > -1 : props.pressed,
  default: () => props.defaultPressed,
  name: 'Toggle',
  state: 'pressed',
});

const { getButtonProps, buttonRef } = useButton({
  disabled: toggleDisabled,
  native: () => props.nativeButton,
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

  emit('update:pressed', nextPressed);
  setPressedState(nextPressed);
}

// A disabled toggle cannot hold the roving focus. The toolbar makes its `disabledIndices` from
// this metadata. A toggle that is not a native button has no `disabled` attribute, so only the
// metadata tells the toolbar.
const itemMetadata = computed<ToolbarRootItemMetadata>(() => ({
  disabled: toggleDisabled.value,
  focusableWhenDisabled: false,
}));

// Only a toggle in a group is an item of a composite, and `useCompositeItem` throws with no
// composite root. The context of a component does not change, so `setup` makes this choice one
// time.
const compositeItem = groupContext
  ? useCompositeItem({ metadata: itemMetadata, disabled: toggleDisabled })
  : undefined;

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: compositeItem ? [compositeItem.compositeRef, buttonRef] : [buttonRef],
  props: (attrs) => {
    // A toggle is never a submit button and never a part of a form.
    const { form, type, ...elementAttrs } = attrs;
    return [
      compositeItem?.compositeProps.value,
      { 'aria-pressed': isPressed.value, onClick },
      elementAttrs,
      getButtonProps,
    ];
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
