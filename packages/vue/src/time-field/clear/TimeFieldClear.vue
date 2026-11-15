<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { TimeFieldRootState } from '../root/TimeFieldRoot.vue';

export type TimeFieldClearState = TimeFieldRootState;

export interface TimeFieldClearProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<TimeFieldClearState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the button ignores user interaction.
   * The button also ignores it while the field is empty, disabled or read-only.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import { rootStateAttributesMapping } from '../../internals/date-time/field/useDateTimeFieldRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeFieldClearProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

defineSlots<{
  /**
   * The content of the button. The default is the text `Clear`.
   */
  default(props: { state: TimeFieldClearState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimeFieldClearState>;
}>();

const context = useDateTimeFieldContext();

const isDisabled = computed(
  () =>
    props.disabled || context.disabled.value || context.readOnly.value || context.state.value.empty,
);

const state = computed<TimeFieldClearState>(() => ({
  ...context.state.value,
  disabled: isDisabled.value,
}));

const { buttonRef, getButtonProps } = useButton({
  native: () => props.nativeButton,
  disabled: isDisabled,
});

function handleClick(event: MouseEvent) {
  if (!isDisabled.value) {
    context.clear(event);
  }
}

const { element, elementProps } = useRenderElement('button', props, {
  state,
  stateAttributesMapping: rootStateAttributesMapping,
  ref: [buttonRef],
  props: (attrs) => [{ onClick: handleClick }, attrs, getButtonProps],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state">Clear</slot></component>
</template>
