<script lang="ts">
import type { PopoverPositionerProps, PopoverPositionerState } from '../../popover/types';

export interface TimePickerPositionerState extends PopoverPositionerState {}

export interface TimePickerPositionerProps extends Omit<
  PopoverPositionerProps,
  'as' | 'anchor' | 'align'
> {
  /**
   * An element to position the popup against.
   * By default, the popup is positioned against the field, and against the trigger when the picker
   * has no field.
   * It can be an element, a component, a virtual element, or a ref or a getter for one of them.
   */
  anchor?: PopoverPositionerProps['anchor'] | undefined;
  /**
   * How to align the popup relative to the specified side. A field is wider than a trigger, so the
   * popup lines up with the start edge of the field.
   * @default 'start'
   */
  align?: PopoverPositionerProps['align'] | undefined;
}
</script>

<script setup lang="ts">
import { computed, toValue, useTemplateRef } from 'vue';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverPositioner from '../../popover/PopoverPositioner.vue';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerPositionerProps>(), {
  align: 'start',
});

defineSlots<{
  default?(scope: { state: TimePickerPositionerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimePickerPositionerState;
  }): unknown;
}>();

const picker = useTimePickerRootContext();

// With no `anchor` and no field, the positioner has no anchor and uses the trigger.
const anchorOf = () => toValue(props.anchor) ?? picker.fields.first.value;

// This part renders `Popover.Positioner` and makes no element of its own.
const positioner = useTemplateRef<{ element: HTMLElement | null }>('positioner');
const element = computed(() => positioner.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <PopoverPositioner
    ref="positioner"
    v-bind="{ ...withoutPropsOf($attrs, PopoverPositioner), ...props, anchor: anchorOf }"
  >
    <template v-if="$slots.element" #element="slotProps">
      <slot name="element" v-bind="slotProps" />
    </template>
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverPositioner>
</template>
