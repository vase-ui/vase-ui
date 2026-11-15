<script setup lang="ts">
import { computed } from 'vue';
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import { markChildrenMounted } from '../../internals/useRenderElement';
import TimeFieldLiteral from '../literal/TimeFieldLiteral.vue';
import TimeFieldSegment from '../segment/TimeFieldSegment.vue';
import type { TimeFieldInputSegment } from './TimeFieldInput.vue';
import { MAX_LAYOUT_ITEMS } from './layoutItems';

defineSlots<{
  /**
   * Renders one item of the layout. The default is `TimeField.Segment` for an editable item and
   * `TimeField.Literal` for each other item.
   */
  segment?(props: { segment: TimeFieldInputSegment; index: number }): unknown;
}>();

const context = useDateTimeFieldContext();

// Vue logs a hydration error when a fragment has another number of items than the server HTML, also
// when the element allows a mismatch of its children. The list thus always has the same number of
// iterations, and each iteration renders one node: an item of the layout, or the comment of `v-if`.
const items = computed(() =>
  Array.from({ length: MAX_LAYOUT_ITEMS }, (_, position) => context.segments.value[position]),
);

markChildrenMounted();
</script>

<template>
  <template v-for="(item, position) in items" :key="`${context.listKey.value}:${position}`">
    <slot v-if="item" name="segment" :segment="item" :index="item.index">
      <TimeFieldSegment v-if="item.editable" :segment="item" />
      <TimeFieldLiteral v-else :segment="item" />
    </slot>
  </template>
</template>
