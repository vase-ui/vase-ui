<script setup lang="ts">
import type { PropType } from 'vue';
import { Resizable } from '../../src/resizable';
import LastPanel from './ResizableLastPanel.vue';

// The panel `c` with its handle, in `KeepAlive`, which holds them while `scene.show` is `false`.
defineProps({
  scene: {
    type: Object as PropType<{ show: boolean; root?: Record<string, unknown> }>,
    required: true,
  },
});
</script>

<template>
  <div style="width: 1000px; height: 100px">
    <Resizable.Root
      style="height: 100%"
      :default-layout="{ a: 20, b: 30, c: 50 }"
      v-bind="scene.root"
    >
      <Resizable.Panel id="a" />
      <Resizable.Handle data-key="h1" aria-label="Resize a" />
      <Resizable.Panel id="b" />
      <KeepAlive>
        <LastPanel v-if="scene.show" />
      </KeepAlive>
    </Resizable.Root>
  </div>
</template>
