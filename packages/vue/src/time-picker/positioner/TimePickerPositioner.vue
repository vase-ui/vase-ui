<script lang="ts">
import type {
  PopoverPositionerProps,
  PopoverPositionerState,
} from '../../popover/positioner/PopoverPositioner.vue';

export interface TimePickerPositionerState extends PopoverPositionerState {}

export interface TimePickerPositionerProps extends Omit<
  PopoverPositionerProps,
  'anchor' | 'align'
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
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverPositioner from '../../popover/positioner/PopoverPositioner.vue';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerPositionerProps>(), {
  as: 'div',
  align: 'start',
});

defineSlots<{
  default(props: { state: TimePickerPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimePickerPositionerState>;
}>();

const picker = useTimePickerRootContext();

// With no `anchor` and no field, the positioner has no anchor and uses the trigger.
const anchorOf = () => toValue(props.anchor) ?? picker.fields.first.value;

const positioner = useTemplateRef<{ element: HTMLElement | null }>('positioner');
const element = computed(() => positioner.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <PopoverPositioner
    v-if="$slots.render"
    ref="positioner"
    v-bind="{ ...withoutPropsOf($attrs, PopoverPositioner), ...props, anchor: anchorOf }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </PopoverPositioner>
  <PopoverPositioner
    v-else
    ref="positioner"
    v-bind="{ ...withoutPropsOf($attrs, PopoverPositioner), ...props, anchor: anchorOf }"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverPositioner>
</template>
