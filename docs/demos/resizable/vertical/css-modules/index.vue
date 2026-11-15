<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';
</script>

<template>
  <Resizable.Root orientation="vertical" :class="styles.Root">
    <Resizable.Panel id="editor" :class="styles.Panel">
      <p :class="styles.Label">Editor</p>
      <p :class="styles.Description">The code of the page.</p>
    </Resizable.Panel>
    <Resizable.Handle primary-panel="next" aria-label="Resize the terminal" :class="styles.Handle" />
    <Resizable.Panel id="terminal" default-size="30" min-size="20" :class="styles.Panel">
      <p :class="styles.Label">Terminal</p>
      <p :class="styles.Description">The output of the build.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
