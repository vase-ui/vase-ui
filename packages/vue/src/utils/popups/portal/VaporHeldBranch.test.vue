<script setup vapor lang="ts">
import type { Component, ShallowRef } from 'vue';
import VaporBranch from './VaporBranch.test.vue';

defineProps<{ visible: ShallowRef<boolean>; mounted: ShallowRef<boolean>; part: Component }>();
</script>

<template>
  <KeepAlive>
    <VaporBranch v-if="visible.value" :mounted="mounted" :part="part" />
  </KeepAlive>
</template>
