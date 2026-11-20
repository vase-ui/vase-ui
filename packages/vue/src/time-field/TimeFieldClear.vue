<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useButton } from '../button/button';
import { injectDateTimeField, stateAttributes } from '../common/date-time-field/field';
import { useElement } from '../common/element';
import type { TimeFieldClearProps, TimeFieldClearState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimeFieldClearProps>();
defineSlots<{
  default?(scope: { state: TimeFieldClearState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimeFieldClearState;
  }): unknown;
}>();

const attrs = useAttrs();
const field = injectDateTimeField();
const { element, setElement } = useElement<HTMLElement>();
const { disabled, mergeAttributes } = useButton({
  element,
  disabled: () =>
    props.disabled || field.state.disabled || field.state.readonly || field.state.empty,
  type: 'button',
});
const state = computed<TimeFieldClearState>(() => ({ ...field.state, disabled: disabled.value }));

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
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
