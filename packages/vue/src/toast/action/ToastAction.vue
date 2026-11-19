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
import { useButton } from '../../internals/use-button/useButton';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastRootContext } from '../root/ToastRootContext';
import { isRenderableNode } from '../utils/useToastLabelPart';
import ToastActionChildren from './ToastActionChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastActionProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Toast.Action');
}

const slots = defineSlots<{
  default(props: { state: ToastActionState }): unknown;
  render(props: { props: HTMLProps; state: ToastActionState; children: Component }): unknown;
}>();

const { toast } = useToastRootContext();

function hasContent() {
  const content = toast.value.actionProps?.children;
  return content === undefined ? slots.default !== undefined : isRenderableNode(content);
}

const state = computed<ToastActionState>(() => ({ type: toast.value.type }));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  button: (element) =>
    useButton(element, {
      disabled: () => props.disabled,
      native: () => props.nativeButton,
    }),
  state,
  props: (attrs) => {
    const { children, ...actionAttrs } = toast.value.actionProps ?? {};
    return [attrs, actionAttrs];
  },
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="hasContent() && usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="ToastActionChildren" />
  <component :is="as" v-else-if="hasContent()" v-bind="elementProps()" :ref="setRef">
    <ToastActionChildren><template v-if="$slots.default" #default><slot :state="state" /></template></ToastActionChildren>
  </component>
</template>
