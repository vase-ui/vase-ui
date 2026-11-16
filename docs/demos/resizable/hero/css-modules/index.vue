<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';
</script>

<template>
  <Resizable.Root :class="styles.Root">
    <Resizable.Panel id="navigation" default-size="25" min-size="15" :class="styles.Panel">
      <p :class="styles.Label">Navigation</p>
      <p :class="styles.Description">The pages of the project.</p>
    </Resizable.Panel>
    <Resizable.Handle aria-label="Resize the navigation" :class="styles.Handle" />
    <Resizable.Panel id="editor" :class="styles.Panel">
      <p :class="styles.Label">Editor</p>
      <p :class="styles.Description">The code of the page.</p>
    </Resizable.Panel>
    <Resizable.Handle primary-panel="next" aria-label="Resize the preview" :class="styles.Handle" />
    <Resizable.Panel id="preview" default-size="30" :class="styles.Panel">
      <p :class="styles.Label">Preview</p>
      <p :class="styles.Description">The page as a visitor sees it.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
