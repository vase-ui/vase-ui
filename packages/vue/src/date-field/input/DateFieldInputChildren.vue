<script setup lang="ts">
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import type { DateTimeFieldSegment } from '../../internals/date-time/field/DateTimeFieldContext';
import { markChildrenMounted } from '../../internals/useRenderElement';
import DateFieldInputLayoutItem from './DateFieldInputLayoutItem.vue';

defineSlots<{
  segment?(props: { segment: DateTimeFieldSegment; index: number }): unknown;
}>();

const context = useDateTimeFieldContext();

markChildrenMounted();
</script>

<!-- prettier-ignore -->
<template>
  <DateFieldInputLayoutItem v-for="segment in context.segments.value" :key="`${context.listKey.value}:${segment.index}`" :segment="segment"><template v-if="$slots.segment" #segment="slotProps"><slot name="segment" v-bind="slotProps" /></template></DateFieldInputLayoutItem>
</template>
