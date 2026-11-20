<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../../internals/types';

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
   * Whether the button should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { createChangeEventDetails } from '../../../internals/createVaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../../internals/types';
import { useButton } from '../../../internals/use-button/useButton';
import { useCastBooleanWarning } from '../../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../../internals/useRenderElement';
import { useDialogRootContext } from '../root/DialogRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogCloseProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Dialog.Close');
}

defineSlots<{
  default(props: { state: DialogCloseState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogCloseState>;
}>();

const store = useDialogRootContext();

const state = computed<DialogCloseState>(() => ({ disabled: props.disabled }));

function handleClick(event: MouseEvent) {
  if (store.select('open')) {
    store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
  }
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  button: (element) =>
    useButton(element, {
      disabled: () => props.disabled,
      native: () => props.nativeButton,
    }),
  state,
  props: (attrs) => [{ onClick: handleClick }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
