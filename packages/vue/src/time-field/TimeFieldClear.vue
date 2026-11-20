<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { injectDateTimeField, stateAttributes } from '../common/date-time-field/field';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import type { TimeFieldClearProps, TimeFieldClearState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimeFieldClearProps>();
defineSlots<{
  default?(scope: { state: TimeFieldClearState }): unknown;
  element?(scope: ElementSlotProps<TimeFieldClearState>): unknown;
}>();

const attrs = useAttrs();
const field = injectDateTimeField();
const { element, setElement } = useElement<HTMLElement>();
const { disabled: isDisabled, mergeAttributes } = useButton({
  element,
  disabled: () =>
    props.disabled || field.state.disabled || field.state.readonly || field.state.empty,
  tag: useAsTag(() => props.as),
  type: 'button',
});
const state = computed<TimeFieldClearState>(() => ({ ...field.state, disabled: isDisabled.value }));

defineExpose({ element });

function elementProps() {
  return mergeAttributes(
    {
      // CSS has `:disabled`.
      ...stateAttributes(field.state),
      'data-disabled': undefined,
      onClick: (event: MouseEvent) => field.clear(event),
    },
    attrs,
  );
}
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
