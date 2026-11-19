<script setup lang="ts">
import { defineComponent, h, KeepAlive, type PropType } from 'vue';
import { Resizable } from '../../src/resizable';

// The panel `c` with its handle, in `KeepAlive`, which holds them while `scene.show` is `false`.
defineProps({
  scene: {
    type: Object as PropType<{ show: boolean; root?: Record<string, unknown> }>,
    required: true,
  },
});
const LastPanel = defineComponent({
  name: 'LastPanel',
  setup: () => () => [
    h(Resizable.Handle, { 'data-key': 'h2', 'aria-label': 'Resize b' }),
    h(Resizable.Panel, { id: 'c' }),
  ],
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
