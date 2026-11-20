<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import MeasureLayoutReader from './MeasureLayoutReader.vue';

// Three flex items in a row. Each one has a first `flex` until the flush after the mount, and
// then its final `flex`. With `read`, a child of the first item reads its width in `onMounted`.
defineProps<{ read?: boolean; transition?: string }>();
const mounted = shallowRef(false);
onMounted(() => (mounted.value = true));
const first = ['0 1 30%', '1 0 0px', '1 0 0px'];
const final = ['30 1 0px', '35 1 0px', '35 1 0px'];
</script>

<template>
  <div style="display: flex; width: 600px; height: 20px">
    <div
      v-for="(flex, index) in mounted ? final : first"
      :key="index"
      class="item"
      :style="{ flex, minWidth: 0, transition }"
    >
      <MeasureLayoutReader v-if="read && index === 0" />
    </div>
  </div>
</template>
