<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';
</script>

<template>
  <Resizable.Root :class="styles.Root">
    <Resizable.Panel id="navigation" default-size="30" :class="styles.Panel">
      <p :class="styles.Label">Navigation</p>
      <p :class="styles.Description">The pages of the project.</p>
    </Resizable.Panel>
    <Resizable.Handle aria-label="Resize the navigation" :class="styles.Handle" />
    <Resizable.Panel id="main" :class="styles.Main">
      <Resizable.Root orientation="vertical" :class="styles.InnerRoot">
        <Resizable.Panel id="editor" :class="styles.Panel">
          <p :class="styles.Label">Editor</p>
          <p :class="styles.Description">Press at the crossing to move both handles.</p>
        </Resizable.Panel>
        <Resizable.Handle primary-panel="next" aria-label="Resize the terminal" :class="styles.Handle" />
        <Resizable.Panel id="terminal" default-size="35" :class="styles.Panel">
          <p :class="styles.Label">Terminal</p>
          <p :class="styles.Description">The output of the build.</p>
        </Resizable.Panel>
      </Resizable.Root>
    </Resizable.Panel>
  </Resizable.Root>
</template>
