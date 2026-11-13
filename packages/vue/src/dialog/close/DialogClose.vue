<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface DialogCloseState {
  /**
   * Whether the button is currently disabled.
   */
  disabled: boolean;
}

export interface DialogCloseProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<DialogCloseState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the button is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { useDialogRootContext } from '../root/DialogRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogCloseProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

defineSlots<{
  default(props: { state: DialogCloseState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogCloseState>;
}>();

const store = useDialogRootContext();

const { getButtonProps, buttonRef } = useButton({
  disabled: () => props.disabled,
  native: () => props.nativeButton,
});

const state = computed<DialogCloseState>(() => ({ disabled: props.disabled }));

function handleClick(event: MouseEvent) {
  if (store.select('open')) {
    store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
  }
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
