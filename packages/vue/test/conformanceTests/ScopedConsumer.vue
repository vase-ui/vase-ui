<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  part: Component;
  partProps: Record<string, unknown>;
  /** The default slot of the vnode of the call. */
  content?: Component;
}>();
</script>

<template>
  <component :is="part" v-bind="partProps" class="scoped-part">
    <template v-if="content" #default>
      <component :is="content" />
    </template>
  </component>
</template>

<style scoped>
.scoped-part {
  outline-style: dashed;
}
</style>
