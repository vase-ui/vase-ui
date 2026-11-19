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
import { useInDisabledFieldset } from '../fieldset/part';
import { useButton } from '../internals/use-button/useButton';
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

const fieldsetDisabled = useInDisabledFieldset(() => element.value);
const isDisabled = computed(() => props.disabled || (props.nativeButton && fieldsetDisabled.value));
const state = computed<ButtonState>(() => ({ disabled: isDisabled.value }));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  button: (element) =>
    useButton(element, {
      disabled: isDisabled,
      focusableWhenDisabled: () => props.focusableWhenDisabled,
      native: () => props.nativeButton,
    }),
  state,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
