<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Calendar } from '../../src/calendar';

// A root whose `element` slot renders a `<section>` of its own.
const today = Temporal.PlainDate.from('2026-11-18');
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart });
</script>

<template>
  <Calendar.Root ref="rootPart" :today="today" locale="en-US">
    <template #element="{ props, elementRef }">
      <section v-bind="props" :ref="elementRef" data-own>content</section>
    </template>
  </Calendar.Root>
</template>
