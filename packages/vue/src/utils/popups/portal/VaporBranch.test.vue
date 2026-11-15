<script setup vapor lang="ts">
import type { Component, ShallowRef } from 'vue';

defineProps<{ mounted: ShallowRef<boolean>; part: Component }>();
</script>

<template>
  <div><component :is="part" v-if="mounted.value" /></div>
</template>
