<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { NumberFieldRootState } from '../root/NumberFieldRoot.vue';

export interface NumberFieldDecrementState extends NumberFieldRootState {}

export interface NumberFieldDecrementProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<NumberFieldDecrementState>,
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
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useNumberFieldStepperButton } from '../root/NumberFieldRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldDecrementProps>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('NumberField.Decrement');
}

defineSlots<{
  default(props: { state: NumberFieldDecrementState }): unknown;
  render: ComponentRenderFn<HTMLProps, NumberFieldDecrementState>;
}>();

const { element, elementProps, setRef, usesRenderSlot, state } = useNumberFieldStepperButton(
  props,
  false,
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
