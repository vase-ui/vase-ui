<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';
</script>

<template>
  <Resizable.Root :class="styles.Root">
    <Resizable.Panel id="navigation" default-size="25" :class="styles.Panel">
      <p :class="styles.Label">Navigation</p>
      <p :class="styles.Description">Drag the line between two panels.</p>
    </Resizable.Panel>
    <Resizable.Handle aria-label="Resize the navigation" :class="styles.Handle" />
    <Resizable.Panel id="editor" :class="styles.Panel">
      <p :class="styles.Label">Editor</p>
      <p :class="styles.Description">Each handle has no size.</p>
    </Resizable.Panel>
    <Resizable.Handle primary-panel="next" aria-label="Resize the preview" :class="styles.Handle" />
    <Resizable.Panel id="preview" default-size="25" :class="styles.Panel">
      <p :class="styles.Label">Preview</p>
      <p :class="styles.Description">Its pointer target takes the press.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
