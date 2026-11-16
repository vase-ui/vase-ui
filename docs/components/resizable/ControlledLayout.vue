<script setup lang="ts">
import { ref } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import type { ResizableRootLayoutSnapshot } from '@vase-ui/vue/resizable';

const layout = ref<ResizableRootLayoutSnapshot>({});
</script>

<template>
  <button type="button" @click="layout = {}">Give the first sizes</button>
  <Resizable.Root v-model:layout="layout">
    <Resizable.Panel id="navigation" :default-size="25" />
    <Resizable.Handle aria-label="Resize the navigation" />
    <Resizable.Panel id="editor" />
  </Resizable.Root>
</template>
