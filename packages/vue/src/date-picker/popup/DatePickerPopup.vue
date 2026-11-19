<script lang="ts">
import type { PopoverPopupProps, PopoverPopupState } from '../../popover/popup/PopoverPopup.vue';

export interface DatePickerPopupState extends PopoverPopupState {}

export interface DatePickerPopupProps extends PopoverPopupProps {
  /**
   * Determines the element to focus when the popup is opened.
   * By default, focus moves to the day of the calendar that has the tab stop: the selected day, or
   * else today. The calendar of a month picker has the month in its place. A popup with no
   * calendar uses the default of the popover: the first tabbable element, except when the popup is
   * opened by touch — then the popup itself is focused to avoid opening the virtual keyboard.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus to the default element.
   * - An element, a component, or a ref of one: Move focus to that element. `null` and an empty ref
   *   use the default element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` or `null` to use the default element, or `false` or
   *   `undefined` to do nothing.
   */
  initialFocus?: PopoverPopupProps['initialFocus'] | undefined;
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { usePickerInitialFocus } from '../../internals/date-time/picker/useDateTimePickerRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverPopup from '../../popover/popup/PopoverPopup.vue';

defineOptions({ inheritAttrs: false });

// An absent Boolean prop is `false` in Vue, and `false` of `initialFocus` and `finalFocus` has a
// meaning. The default `undefined` tells an absent prop from `false`.
const props = withDefaults(defineProps<DatePickerPopupProps>(), {
  as: 'div',
  initialFocus: undefined,
  finalFocus: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('DatePicker.Popup');
}

defineSlots<{
  default(props: { state: DatePickerPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, DatePickerPopupState>;
}>();

const pickerInitialFocus = usePickerInitialFocus(() => props.initialFocus);

const popup = useTemplateRef<{ element: HTMLElement | null }>('popup');
const element = computed(() => popup.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <PopoverPopup
    v-if="$slots.render"
    ref="popup"
    v-bind="{ ...withoutPropsOf($attrs, PopoverPopup), ...props, initialFocus: pickerInitialFocus }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </PopoverPopup>
  <PopoverPopup
    v-else
    ref="popup"
    v-bind="{ ...withoutPropsOf($attrs, PopoverPopup), ...props, initialFocus: pickerInitialFocus }"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverPopup>
</template>
