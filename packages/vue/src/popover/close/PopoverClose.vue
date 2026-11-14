<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface PopoverCloseState {}

export interface PopoverCloseProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<PopoverCloseState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the button should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { useClosePartRegistration } from '../utils/closePart';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverCloseProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

defineSlots<{
  default(props: { state: PopoverCloseState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverCloseState>;
}>();

const store = usePopoverRootContext();
useClosePartRegistration();

const { getButtonProps, buttonRef } = useButton({
  disabled: () => props.disabled,
  focusableWhenDisabled: false,
  native: () => props.nativeButton,
});

const state: PopoverCloseState = EMPTY_OBJECT;

function handleClick(event: MouseEvent) {
  store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
}

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: buttonRef,
  props: (attrs) => [{ onClick: handleClick }, attrs, getButtonProps],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
