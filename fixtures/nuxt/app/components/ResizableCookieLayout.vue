<script setup lang="ts">
import { ref } from 'vue';
import { useCookie } from '#imports';
import { Resizable, type ResizableLayout } from '@vase-ui/vue/resizable';

const saved = useCookie<ResizableLayout | undefined>('resizable-layout');
// The server reads the cookie too, so its HTML has the saved layout. A visitor can change the
// cookie. The root ignores an entry that is not a size, so the cookie needs no check.
const layout = ref<ResizableLayout>(saved.value ?? { 'c-a': 25, 'c-b': 75 });

// One commit comes for each change of the user. The layout has the pixels of the fixed panel,
// so the panel keeps its width at the next visit.
function save(committed: ResizableLayout) {
  saved.value = committed;
}
</script>

<template>
  <Resizable.Root
    v-model="layout"
    data-testid="cookie"
    style="width: 600px; height: 80px"
    @layout-committed="save"
  >
    <Resizable.Panel id="c-a" data-testid="c-a" root-resize-behavior="fixed" />
    <Resizable.Handle
      data-testid="cookie-handle"
      aria-label="Resize the first panel"
      style="width: 0"
    />
    <Resizable.Panel id="c-b" data-testid="c-b" />
  </Resizable.Root>
</template>
