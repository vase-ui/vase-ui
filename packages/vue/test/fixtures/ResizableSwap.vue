<script setup lang="ts">
import type { PropType } from 'vue';
import { Resizable } from '../../src/resizable';

// Two panels with one `id`, in `v-if` and `v-else`.
defineProps({
  swap: { type: Object as PropType<{ second: boolean }>, required: true },
});
</script>

<template>
  <div style="width: 1000px; height: 100px">
    <Resizable.Root style="height: 100%" :default-layout="{ main: 70 }">
      <Resizable.Panel v-if="swap.second" id="main" data-variant="second" />
      <Resizable.Panel v-else id="main" data-variant="first" />
      <Resizable.Handle aria-label="Resize main" />
      <Resizable.Panel id="side" />
    </Resizable.Root>
  </div>
</template>
