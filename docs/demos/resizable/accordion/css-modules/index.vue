<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import AccordionHeader from './AccordionHeader.vue';
import styles from './index.module.css';
</script>

<template>
  <Resizable.Root orientation="vertical" :class="styles.Root">
    <Resizable.Panel
      id="files"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      :class="styles.Panel"
    >
      <AccordionHeader>Files</AccordionHeader>
      <p :class="styles.Description">The pages of the project.</p>
    </Resizable.Panel>
    <Resizable.Handle aria-label="Resize the files" :class="styles.Handle" />
    <Resizable.Panel
      id="outline"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      :class="styles.Panel"
    >
      <AccordionHeader>Outline</AccordionHeader>
      <p :class="styles.Description">The headings of the page.</p>
    </Resizable.Panel>
    <Resizable.Handle
      primary-panel="next"
      aria-label="Resize the timeline"
      :class="styles.Handle"
    />
    <Resizable.Panel
      id="timeline"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      :class="styles.Panel"
    >
      <AccordionHeader>Timeline</AccordionHeader>
      <p :class="styles.Description">The changes to the page.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
