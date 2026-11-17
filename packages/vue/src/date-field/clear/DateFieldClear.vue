<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { DateFieldRootState } from '../root/DateFieldRoot.vue';

export interface DateFieldClearState extends DateFieldRootState {}

export interface DateFieldClearProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<DateFieldClearState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the button should ignore user interaction. The button also ignores it while the field
   * is empty, disabled or read-only.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { computed, useSlots } from 'vue';
import type { Component } from 'vue';
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import { rootStateAttributesMapping } from '../../internals/date-time/field/useDateTimeFieldRoot';
import type { HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import DateFieldClearChildren from './DateFieldClearChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateFieldClearProps>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('DateField.Clear');
}

defineSlots<{
  /**
   * The content of the button. The default is `x`, and the button then has the `aria-label` `Clear`.
   */
  default(props: { state: DateFieldClearState }): unknown;
  render(props: { props: HTMLProps; state: DateFieldClearState; children: Component }): unknown;
}>();

const slots = useSlots();
const context = useDateTimeFieldContext();

const isDisabled = computed(
  () =>
    props.disabled || context.disabled.value || context.readOnly.value || context.state.value.empty,
);

const state = computed<DateFieldClearState>(() => ({
  ...context.state.value,
  disabled: isDisabled.value,
}));

const { buttonRef, getButtonProps } = useButton({
  native: () => props.nativeButton,
  disabled: isDisabled,
});

const { element, elementProps } = useRenderElement('button', props, {
  state,
  stateAttributesMapping: rootStateAttributesMapping,
  ref: [buttonRef],
  props: (attrs) => [
    {
      // The button names itself only when it shows its own `x`.
      'aria-label': slots.default || slots.render ? undefined : 'Clear',
      onClick(event: MouseEvent) {
        context.clear(event);
      },
    },
    attrs,
    getButtonProps,
  ],
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="DateFieldClearChildren" />
  <component :is="as" v-else v-bind="elementProps()"><DateFieldClearChildren><template v-if="$slots.default" #default><slot :state="state" /></template></DateFieldClearChildren></component>
</template>
