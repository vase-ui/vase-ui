<script setup lang="ts">
import { data } from '../../benchmarks.data.ts';

const props = defineProps<{
  /** The id of a note of `benchmarks/notes.json`, or the anchor of a section of the page. */
  note: string;
  /** The title of the target. The default is the title of the note. */
  title?: string;
}>();

const title = props.title ?? data.notes.find((note) => note.id === props.note)?.title ?? props.note;
</script>

<template>
  <a :href="`#${note}`" :aria-label="`Reason: ${title}`">*</a>
</template>
