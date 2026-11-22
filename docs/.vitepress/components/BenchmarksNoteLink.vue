<script setup lang="ts">
import { data } from '../../benchmarks.data.ts';

const props = defineProps<{
  /** The id of a note of `benchmarks/notes.json`. */
  note: string;
}>();

const title = data.notes.find((note) => note.id === props.note)?.title ?? props.note;
</script>

<template>
  <a :href="`#${note}`" :aria-label="`Reason: ${title}`">*</a>
</template>
