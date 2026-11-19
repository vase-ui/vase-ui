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
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { useClosePartRegistration } from '../utils/closePart';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverCloseProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Popover.Close');
}

defineSlots<{
  default(props: { state: PopoverCloseState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverCloseState>;
}>();

const { requestOpen } = usePopoverRootContext();
useClosePartRegistration();

const state: PopoverCloseState = EMPTY_OBJECT;

function handleClick(event: MouseEvent) {
  requestOpen(false, createChangeEventDetails(REASONS.closePress, event));
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  button: (element) =>
    useButton(element, {
      disabled: () => props.disabled,
      focusableWhenDisabled: false,
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
