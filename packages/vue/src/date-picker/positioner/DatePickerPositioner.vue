<script lang="ts">
import type {
  PopoverPositionerProps,
  PopoverPositionerState,
} from '../../popover/positioner/PopoverPositioner.vue';

export interface DatePickerPositionerState extends PopoverPositionerState {}

export interface DatePickerPositionerProps extends Omit<PopoverPositionerProps, 'anchor'> {
  /**
   * An element to position the popup against.
   * By default, the popup is positioned against the field, and against the trigger when the picker
   * has no field.
   * It can be an element, a component, a virtual element, or a ref or a getter for one of them.
   */
  anchor?: PopoverPositionerProps['anchor'] | undefined;
}
</script>

<script setup lang="ts">
import { computed, toValue, useTemplateRef } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import PopoverPositioner from '../../popover/positioner/PopoverPositioner.vue';
import { useDatePickerRootContext } from '../root/DatePickerRootContext';

defineOptions({ inheritAttrs: false });

// A field is wider than a trigger, so the popup lines up with its start edge.
const props = withDefaults(defineProps<DatePickerPositionerProps>(), {
  as: 'div',
  align: 'start',
});

defineSlots<{
  default(props: { state: DatePickerPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, DatePickerPositionerState>;
}>();

const picker = useDatePickerRootContext();

// With no `anchor` and no field, the positioner has no anchor and uses the trigger.
const anchor = () => toValue(props.anchor) ?? picker.fieldElement.value;

// This part renders `Popover.Positioner` and makes no element of its own. The template has one form
// for `#render` and one for the content. A `v-if` on a slot template makes the slots of
// `Popover.Positioner` dynamic. Vue then renders `Popover.Positioner` again each time this part
// renders. It also renders again each part in that slot that has slot content.
const positioner = useTemplateRef<{ element: HTMLElement | null }>('positioner');
const element = computed(() => positioner.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <PopoverPositioner v-if="$slots.render" ref="positioner" v-bind="{ ...$attrs, ...props, anchor }">
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </PopoverPositioner>
  <PopoverPositioner v-else ref="positioner" v-bind="{ ...$attrs, ...props, anchor }">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PopoverPositioner>
</template>
