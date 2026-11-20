<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Resizable, type ResizableLayout } from '@vase-ui/vue/resizable';

const key = 'nuxt-resizable';
const layout = ref<ResizableLayout>({});

// A server has no storage, so the page reads it after the mount.
onMounted(() => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (stored !== null && typeof stored === 'object') layout.value = stored as ResizableLayout;
  } catch {
    layout.value = {};
  }
});

function save(committed: ResizableLayout) {
  try {
    localStorage.setItem(key, JSON.stringify(committed));
  } catch {
    // The layout stays for this visit only.
  }
}
</script>

<template>
  <main>
    <Resizable.Root data-testid="percent" style="width: 600px; height: 80px">
      <Resizable.Panel id="p-a" data-testid="p-a" :default-size="30" />
      <Resizable.Handle aria-label="Resize p-a" style="width: 0" />
      <Resizable.Panel id="p-b" data-testid="p-b" />
      <Resizable.Handle aria-label="Resize p-b" style="width: 0" />
      <Resizable.Panel id="p-c" data-testid="p-c" />
    </Resizable.Root>
    <Resizable.Root data-testid="length" style="width: 600px; height: 80px">
      <Resizable.Panel id="l-a" data-testid="l-a" default-size="240px" />
      <Resizable.Handle aria-label="Resize l-a" style="width: 0" />
      <Resizable.Panel id="l-b" data-testid="l-b" />
    </Resizable.Root>
    <ResizableCookieLayout />
    <Resizable.Root
      v-model="layout"
      data-testid="stored"
      style="width: 600px; height: 80px"
      @layout-committed="save"
    >
      <Resizable.Panel id="s-a" data-testid="s-a" />
      <Resizable.Handle aria-label="Resize s-a" style="width: 0" />
      <Resizable.Panel id="s-b" data-testid="s-b" />
    </Resizable.Root>
  </main>
</template>
