<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';
</script>

<template>
  <Resizable.Root drag-edges :class="styles.Root">
    <Resizable.Panel id="navigation" default-size="25" :class="styles.Panel">
      <p :class="styles.Label">Navigation</p>
      <p :class="styles.Description">Drag the line between two panels.</p>
    </Resizable.Panel>
    <Resizable.Panel id="editor" :class="styles.Panel">
      <p :class="styles.Label">Editor</p>
      <p :class="styles.Description">The panels have no handle.</p>
    </Resizable.Panel>
    <Resizable.Panel id="preview" default-size="25" :class="styles.Panel">
      <p :class="styles.Label">Preview</p>
      <p :class="styles.Description">A keyboard user needs a handle.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
