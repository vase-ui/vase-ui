<script setup lang="ts">
// Vue writes no `class` on a server for this root element while the class is undefined.
// A client mount writes `class=""`.
defineProps<{
  /** The class of the element. */
  elementClass?: string | undefined;
}>();
</script>

<template>
  <div :class="elementClass" />
</template>
