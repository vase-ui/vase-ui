<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';

defineProps<{
  /** The accessible name of the box while it scrolls, such as `Props of Dialog.Root`. */
  label: string;
}>();

const box = useTemplateRef('box');
const scrolls = ref(false);
let observer: ResizeObserver | undefined;

// A keyboard user scrolls the box with the arrow keys, so the box or an element in it must take the
// focus (WCAG 2.1.1). A table of the API reference has no such element. The box takes the focus
// only while its content is wider than the box, so a box that does not scroll adds no stop to the
// sequence of the Tab key. A box that can get the focus has a role and a name, as WAI-ARIA requires
// for each focusable element. The role is `group`, not `region`, because a table is not a landmark
// of the page.
onMounted(() => {
  const element = box.value;
  if (!element) {
    return;
  }
  observer = new ResizeObserver(() => {
    scrolls.value = element.scrollWidth > element.clientWidth;
  });
  observer.observe(element);
  for (const child of element.children) {
    observer.observe(child);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <div
    ref="box"
    class="scroll-box"
    :role="scrolls ? 'group' : undefined"
    :aria-label="scrolls ? label : undefined"
    :tabindex="scrolls ? 0 : undefined"
  >
    <slot />
  </div>
</template>
