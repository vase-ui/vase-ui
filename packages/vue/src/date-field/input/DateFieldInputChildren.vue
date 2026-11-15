<script setup lang="ts">
import { computed } from 'vue';
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import type { DateTimeFieldSegment } from '../../internals/date-time/field/DateTimeFieldContext';
import { MAX_LAYOUT_LENGTH } from '../../internals/date-time/field/segmentLayout';
import { markChildrenMounted } from '../../internals/useRenderElement';
import DateFieldLiteral from '../literal/DateFieldLiteral.vue';
import DateFieldSegment from '../segment/DateFieldSegment.vue';

defineSlots<{
  segment?(props: { segment: DateTimeFieldSegment; index: number }): unknown;
}>();

const context = useDateTimeFieldContext();

// The layout of a server can have more or fewer parts than the first layout of the browser. Vue
// logs `Hydration completed but contains mismatches` for a fragment with another number of items,
// also under `data-allow-mismatch`. Each position thus renders one part, or the comment of a
// `v-if` after the last part, so the fragment has the same length in each place.
const positions = computed(() => {
  const segments = context.segments.value;
  return Array.from(
    { length: Math.max(MAX_LAYOUT_LENGTH.date, segments.length) },
    (_, index) => segments[index],
  );
});

markChildrenMounted();
</script>

<!-- prettier-ignore -->
<template>
  <template v-for="(segment, index) in positions" :key="`${context.listKey.value}:${index}`">
    <slot v-if="segment" name="segment" :segment="segment" :index="index"><DateFieldSegment v-if="segment.editable" :segment="segment" /><DateFieldLiteral v-else :segment="segment" /></slot>
  </template>
</template>
