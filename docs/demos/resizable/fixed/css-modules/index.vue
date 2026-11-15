<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';
</script>

<template>
  <Resizable.Root :class="styles.Root">
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
    </Resizable.Panel>
  </Resizable.Root>
</template>
