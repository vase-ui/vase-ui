<script setup lang="ts">
import { ref } from 'vue';
import { Resizable, type ResizableLayout } from '@vase-ui/vue/resizable';
import styles from './index.module.css';

// The layout has the width of the navigation in pixels.
const layout = ref<ResizableLayout>({});
</script>

<template>
  <Resizable.Root v-model="layout" :class="styles.Root">
    <Resizable.Panel
      id="navigation"
      default-size="240px"
      min-size="10rem"
      max-size="50vw"
      root-resize-behavior="fixed"
      :class="styles.Panel"
    >
      <p :class="styles.Label">Navigation</p>
      <p :class="styles.Description">Resize the window: the navigation keeps its width.</p>
    </Resizable.Panel>
    <Resizable.Handle aria-label="Resize the navigation" :class="styles.Handle" />
    <Resizable.Panel id="editor" :class="styles.Panel">
      <p :class="styles.Label">Editor</p>
      <p :class="styles.Description">The editor takes the rest of the width.</p>
      <p :class="styles.Description">The layout: {{ JSON.stringify(layout) }}</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
