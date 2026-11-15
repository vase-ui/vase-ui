<script setup lang="ts">
import type { DateTimeFieldSegment } from '../../internals/date-time/field/DateTimeFieldContext';
import DateFieldLiteral from '../literal/DateFieldLiteral.vue';
import DateFieldSegment from '../segment/DateFieldSegment.vue';

defineProps<{
  segment: DateTimeFieldSegment;
}>();

defineSlots<{
  segment?(props: { segment: DateTimeFieldSegment; index: number }): unknown;
}>();
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.segment" name="segment" :segment="segment" :index="segment.index" />
  <DateFieldSegment v-else-if="segment.editable" :segment="segment" />
  <DateFieldLiteral v-else :segment="segment" />
</template>
