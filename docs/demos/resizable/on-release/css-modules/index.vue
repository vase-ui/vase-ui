<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';
</script>

<template>
  <Resizable.Root resize-mode="on-release" :class="styles.Root">
    <Resizable.Panel id="navigation" default-size="30" :class="styles.Panel">
      <p :class="styles.Label">Navigation</p>
      <p :class="styles.Description">A drag shows a line, and the panels change at the release.</p>
    </Resizable.Panel>
    <Resizable.Handle aria-label="Resize the navigation" :class="styles.Handle" />
    <Resizable.Panel id="editor" :class="styles.Panel">
      <p :class="styles.Label">Editor</p>
      <p :class="styles.Description">The code of the page.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
