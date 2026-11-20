<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { injectDateTimeField, stateAttributes } from '../common/date-time-field/field';
import { useElement } from '../common/element';
import DateFieldLiteral from './DateFieldLiteral.vue';
import DateFieldSegment from './DateFieldSegment.vue';
import type { DateFieldInputProps, DateFieldInputSegment, DateFieldInputState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<DateFieldInputProps>();
defineSlots<{
  /**
   * Renders one item of the layout. The default is `DateField.Segment` for an editable item and
   * `DateField.Literal` for each other item.
   */
  segment?(scope: { segment: DateFieldInputSegment; index: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DateFieldInputState;
    segments: readonly DateFieldInputSegment[];
  }): unknown;
}>();

const attrs = useAttrs();
const field = injectDateTimeField();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<DateFieldInputState>(() => field.state);

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
        <DateFieldSegment v-if="segment.editable" :segment="segment" />
        <DateFieldLiteral v-else :segment="segment" />
      </slot>
    </template>
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <template v-for="(segment, index) in field.segments" :key="index">
      <slot name="segment" :segment="segment" :index="index">
        <DateFieldSegment v-if="segment.editable" :segment="segment" />
        <DateFieldLiteral v-else :segment="segment" />
      </slot>
    </template>
  </div>
</template>
