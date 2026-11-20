<script setup lang="ts">
import type { ElementSlotProps } from '../common/element';
import { useNavigationButton } from './navigation';
import type { CalendarPreviousButtonProps, CalendarPreviousButtonState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarPreviousButtonProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: CalendarPreviousButtonState }): unknown;
  element?(scope: ElementSlotProps<CalendarPreviousButtonState>): unknown;
}>();

const { element, setElement, state, elementProps } = useNavigationButton(props, -1);

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
