<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface ToastCloseState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastCloseProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<ToastCloseState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the button should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { useToastRootContext } from '../root/ToastRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastCloseProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

defineSlots<{
  default(props: { state: ToastCloseState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToastCloseState>;
}>();

const store = useToastProviderContext();
const { toast, expanded } = useToastRootContext();

const hasFocus = shallowRef(false);

const { getButtonProps, buttonRef } = useButton({
  disabled: () => props.disabled,
  native: () => props.nativeButton,
});

const state = computed<ToastCloseState>(() => ({ type: toast.value.type }));

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: buttonRef,
  props: (attrs) => [
    {
      'aria-hidden': !expanded.value && !hasFocus.value,
      onClick() {
        store.closeToast(toast.value.id);
      },
      onFocusin() {
        hasFocus.value = true;
      },
      onFocusout() {
        hasFocus.value = false;
      },
    },
    attrs,
    getButtonProps,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
