<script lang="ts">
import type { PopoverPositionerProps, PopoverPositionerState } from '../../popover/types';

export interface DateRangePickerPositionerState extends PopoverPositionerState {}

export interface DateRangePickerPositionerProps extends Omit<
  PopoverPositionerProps,
  'as' | 'anchor' | 'align'
> {
  /**
   * An element to position the popup against.
   * By default, the popup is positioned against the box around the two fields, and against the
   * trigger when the picker has no field.
   * It can be an element, a component, a virtual element, or a ref or a getter for one of them.
   */
  anchor?: PopoverPositionerProps['anchor'] | undefined;
  /**
   * How to align the popup relative to the specified side. The fields are wider than a trigger, so
   * the popup lines up with the start edge of the fields.
   * @default 'start'
   */
  align?: PopoverPositionerProps['align'] | undefined;
}
</script>

<script setup lang="ts">
import { computed, toValue, useTemplateRef } from 'vue';
import PopoverPositioner from '../../popover/PopoverPositioner.vue';
import { useDateRangePickerRootContext } from '../root/DateRangePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerPositionerProps>(), {
  align: 'start',
});

defineSlots<{
  default?(scope: { state: DateRangePickerPositionerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DateRangePickerPositionerState;
  }): unknown;
}>();

const picker = useDateRangePickerRootContext();

// A virtual element has the box around the two fields, so the popup lines up with the two of them.
// With one field only, the popup lines up with that field. With no field, the positioner has no
// anchor and uses the trigger.
const fieldsAnchor = computed(() => {
  const start = picker.startFields.first.value;
  const end = picker.endFields.first.value;
  if (!start || !end) {
    return start ?? end;
  }
  return {
    contextElement: start,
    getBoundingClientRect() {
      const a = start.getBoundingClientRect();
      const b = end.getBoundingClientRect();
      const left = Math.min(a.left, b.left);
      const top = Math.min(a.top, b.top);
      const right = Math.max(a.right, b.right);
      const bottom = Math.max(a.bottom, b.bottom);
      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        left,
        top,
        right,
        bottom,
      };
    },
  };
});
const anchorOf = () => toValue(props.anchor) ?? fieldsAnchor.value;

// This part renders `Popover.Positioner` and makes no element of its own.
const positioner = useTemplateRef<{ element: HTMLElement | null }>('positioner');
const element = computed(() => positioner.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <PopoverPositioner ref="positioner" v-bind="{ ...$attrs, ...props, anchor: anchorOf }">
    <template v-if="$slots.element" #element="slotProps">
      <slot name="element" v-bind="slotProps" />
    </template>
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverPositioner>
</template>
