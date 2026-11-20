<script setup lang="ts">
import { inject, onServerPrefetch, useId } from 'vue';
import MeasureIdChild from './MeasureIdChild.vue';

const props = defineProps<{ name: string; prefetch?: boolean; showNames?: boolean }>();
// Each sibling adds its name in `setup`. The list is not reactive, so the render shows the names
// that are in it when the render runs.
const names = inject<string[]>('names', []);
names.push(props.name);
if (props.prefetch) onServerPrefetch(() => {});
const id = useId();
</script>

<template>
  <p :id="id" :data-names="showNames ? names.join(' ') : undefined"><MeasureIdChild /></p>
</template>
