<script setup lang="ts">
import { computed, type PropType } from 'vue';
import CalendarParts from './CalendarParts.vue';

// `CalendarParts` with props that a server render can take: each date, month and range is ISO
// text. `root` holds the other props of the root.
const props = defineProps({
  today: String,
  value: String,
  month: String,
  range: Array as PropType<string[]>,
  root: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  selects: Boolean,
  views: Boolean,
  weekNumbers: Boolean,
});

const rootProps = computed(() => ({
  locale: 'en-US',
  ...props.root,
  ...(props.today && { today: Temporal.PlainDate.from(props.today) }),
  ...(props.value && { defaultValue: Temporal.PlainDate.from(props.value) }),
  ...(props.month && { defaultMonth: Temporal.PlainYearMonth.from(props.month) }),
  ...(props.range && {
    defaultValue: props.range.map((end) => end && Temporal.PlainDate.from(end)),
  }),
}));
</script>

<template>
  <CalendarParts
    :root="rootProps"
    :range="!!range"
    :selects="selects"
    :views="views"
    :week-numbers="weekNumbers"
  />
</template>
