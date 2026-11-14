<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface ToastActionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastActionProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<ToastActionState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the button should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastRootContext } from '../root/ToastRootContext';
import { isRenderableNode } from '../utils/isRenderableNode';
import { useHasDefaultSlot } from '../utils/useToastLabelPart';
import ToastActionChildren from './ToastActionChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastActionProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

defineSlots<{
  default(props: { state: ToastActionState }): unknown;
  render(props: { props: HTMLProps; state: ToastActionState; children: Component }): unknown;
}>();

const { toast } = useToastRootContext();
const hasDefaultSlot = useHasDefaultSlot();

// The content of `actionProps` wins over the default slot, as in Base UI.
const rendered = computed(() => {
  const content = toast.value.actionProps?.children;
  return content === undefined ? hasDefaultSlot.value : isRenderableNode(content);
});

const { getButtonProps, buttonRef } = useButton({
  disabled: () => props.disabled,
  native: () => props.nativeButton,
});

const state = computed<ToastActionState>(() => ({ type: toast.value.type }));

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: buttonRef,
  props: (attrs) => {
    const { children, ...actionAttrs } = toast.value.actionProps ?? {};
    return [attrs, actionAttrs, getButtonProps];
  },
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <template v-if="rendered">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="ToastActionChildren" />
    <component :is="as" v-else v-bind="elementProps()"><ToastActionChildren><template v-if="$slots.default" #default><slot :state="state" /></template></ToastActionChildren></component>
  </template>
</template>
