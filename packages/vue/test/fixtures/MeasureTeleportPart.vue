<script setup lang="ts">
// A part with a `<Teleport>` as its root and one element under `v-if`.
defineOptions({ inheritAttrs: false });
defineProps<{ to: HTMLElement | null; show: boolean }>();
</script>

<template>
  <Teleport :to="to" :disabled="!to">
    <div v-if="show" v-bind="$attrs"><slot /></div>
  </Teleport>
</template>
