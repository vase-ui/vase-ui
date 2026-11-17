<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../internals/types';

export interface ButtonState {
  /**
   * Whether the button should ignore user interaction.
   */
  disabled: boolean;
}

export interface ButtonProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<ButtonState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the button should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the button should be focusable when disabled.
   * @default false
   */
  focusableWhenDisabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useFieldsetDisabled } from '../fieldset/root/useFieldsetDisabled';
import { useButton } from '../internals/use-button';
import { useCastBooleanWarning } from '../internals/useCastBooleanWarning';
import { useRenderElement } from '../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ButtonProps>(), {
  as: 'button',
  disabled: false,
  focusableWhenDisabled: false,
  nativeButton: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Button');
}

defineSlots<{
  default(props: { state: ButtonState }): unknown;
  render: ComponentRenderFn<HTMLProps, ButtonState>;
}>();

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(() => props.disabled || (props.nativeButton && fieldsetDisabled.value));
const state = computed<ButtonState>(() => ({ disabled: isDisabled.value }));

const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
  focusableWhenDisabled: () => props.focusableWhenDisabled,
  native: () => props.nativeButton,
});

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: buttonRef,
  props: (attrs) => [attrs, getButtonProps],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
