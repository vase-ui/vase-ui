<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { NumberFieldRootState } from '../root/NumberFieldRoot.vue';

export interface NumberFieldIncrementState extends NumberFieldRootState {}

export interface NumberFieldIncrementProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<NumberFieldIncrementState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the stepper should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useNumberFieldStepperButton } from '../root/useNumberFieldStepperButton';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldIncrementProps>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
});

defineSlots<{
  default(props: { state: NumberFieldIncrementState }): unknown;
  render: ComponentRenderFn<HTMLProps, NumberFieldIncrementState>;
}>();

const { element, elementProps, state } = useNumberFieldStepperButton(props, true);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
