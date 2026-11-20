<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { injectDateTimeField, stateAttributes } from '../common/date-time-field/field';
import { useElement } from '../common/element';
import TimeFieldLiteral from './TimeFieldLiteral.vue';
import TimeFieldSegment from './TimeFieldSegment.vue';
import type { TimeFieldInputProps, TimeFieldInputSegment, TimeFieldInputState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<TimeFieldInputProps>();
defineSlots<{
  /**
   * Renders one item of the layout. The default is `TimeField.Segment` for an editable item and
   * `TimeField.Literal` for each other item.
   */
  segment?(scope: { segment: TimeFieldInputSegment; index: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimeFieldInputState;
    segments: readonly TimeFieldInputSegment[];
  }): unknown;
}>();

const attrs = useAttrs();
const field = injectDateTimeField();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<TimeFieldInputState>(() => field.state);

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      ...stateAttributes(field.state),
      // A server with other `Intl` data has other segments and literals.
      'data-allow-mismatch': 'children',
      onMousedown,
    },
    attrs,
  );
}

// A press outside a segment gives the focus to the first empty segment.
function onMousedown(event: MouseEvent) {
  if (event.defaultPrevented || field.state.disabled) return;
  event.preventDefault();
  field.focusEmpty();
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
    :segments="field.segments"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <template v-for="(segment, index) in field.segments" :key="index">
      <slot name="segment" :segment="segment" :index="index">
        <TimeFieldSegment v-if="segment.editable" :segment="segment" />
        <TimeFieldLiteral v-else :segment="segment" />
      </slot>
    </template>
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <template v-for="(segment, index) in field.segments" :key="index">
      <slot name="segment" :segment="segment" :index="index">
        <TimeFieldSegment v-if="segment.editable" :segment="segment" />
        <TimeFieldLiteral v-else :segment="segment" />
      </slot>
    </template>
  </div>
</template>
