<script setup lang="ts">
import { onMounted, shallowRef, useTemplateRef } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import AccordionHeader from './AccordionHeader.vue';
import styles from './index.module.css';

const files = useTemplateRef('files');
const outline = useTemplateRef('outline');
const timeline = useTemplateRef('timeline');
// The panels get their sizes at the mount. The transition starts two frames later, so that it
// does not animate them.
const animated = shallowRef(false);
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => (animated.value = true))));

function toggle(panel: { collapse(): void; expand(): void } | null, collapsed: boolean) {
  if (collapsed) panel?.expand();
  else panel?.collapse();
}
</script>

<template>
  <Resizable.Root orientation="vertical" :class="styles.Root">
    <Resizable.Panel
      id="files"
      ref="files"
      v-slot="{ state }"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      :class="[styles.Panel, animated && styles.Animated]"
    >
      <AccordionHeader
        :expanded="!state.collapsed"
        controls="files"
        @toggle="toggle(files, state.collapsed)"
      >
        Files
      </AccordionHeader>
      <p :class="styles.Description">The pages of the project.</p>
    </Resizable.Panel>
    <Resizable.Handle aria-label="Resize the files" :class="styles.Handle" />
    <Resizable.Panel
      id="outline"
      ref="outline"
      v-slot="{ state }"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      :class="[styles.Panel, animated && styles.Animated]"
    >
      <AccordionHeader
        :expanded="!state.collapsed"
        controls="outline"
        @toggle="toggle(outline, state.collapsed)"
      >
        Outline
      </AccordionHeader>
      <p :class="styles.Description">The headings of the page.</p>
    </Resizable.Panel>
    <Resizable.Handle
      primary-panel="next"
      aria-label="Resize the timeline"
      :class="styles.Handle"
    />
    <Resizable.Panel
      id="timeline"
      ref="timeline"
      v-slot="{ state }"
      collapsible
      collapsed-size="40px"
      min-size="80px"
      :class="[styles.Panel, animated && styles.Animated]"
    >
      <AccordionHeader
        :expanded="!state.collapsed"
        controls="timeline"
        @toggle="toggle(timeline, state.collapsed)"
      >
        Timeline
      </AccordionHeader>
      <p :class="styles.Description">The changes to the page.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
