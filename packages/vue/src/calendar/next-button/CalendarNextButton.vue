<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarNextButtonState extends CalendarState {}

export interface CalendarNextButtonProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<CalendarNextButtonState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * Whether the button should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useCalendarNavigationButton } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarNextButtonProps>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Calendar.NextButton');
}

defineSlots<{
  default(props: { state: CalendarNextButtonState }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarNextButtonState>;
}>();

const { element, elementProps, setRef, usesRenderSlot, state } = useCalendarNavigationButton(
  props,
  1,
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
