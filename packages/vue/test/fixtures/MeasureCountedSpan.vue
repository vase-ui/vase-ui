<script setup lang="ts">
import type { PropType } from 'vue';

// A span that calls `count` in its template, so each render of the span calls it once.
defineProps({
  index: { type: Number, required: true },
  count: { type: Function as PropType<() => string>, required: true },
});
</script>

<template>
  <span class="item">{{ count() }}{{ index }}</span>
</template>
