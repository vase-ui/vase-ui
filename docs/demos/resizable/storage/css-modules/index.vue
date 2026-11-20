<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Resizable, type ResizableLayout } from '@vase-ui/vue/resizable';
import styles from './index.module.css';

const key = 'vase-ui-docs-resizable';
const layout = ref<ResizableLayout>({});

// A server has no storage, so the page reads it after the mount. A browser that blocks the data
// of the site throws. The root ignores an entry that is not a size.
onMounted(() => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (saved !== null && typeof saved === 'object') layout.value = saved as ResizableLayout;
  } catch {
    layout.value = {};
  }
});

// One commit comes for each change of the user.
function save(committed: ResizableLayout) {
  try {
    localStorage.setItem(key, JSON.stringify(committed));
  } catch {
    // The layout stays for this visit only.
  }
}
</script>

<template>
  <Resizable.Root v-model="layout" :class="styles.Root" @layout-committed="save">
    <Resizable.Panel id="navigation" default-size="30" :class="styles.Panel">
      <p :class="styles.Label">Navigation</p>
      <p :class="styles.Description">Resize the panels, then load the page again.</p>
    </Resizable.Panel>
    <Resizable.Handle aria-label="Resize the navigation" :class="styles.Handle" />
    <Resizable.Panel id="editor" :class="styles.Panel">
      <p :class="styles.Label">Editor</p>
      <p :class="styles.Description">The layout stays in the storage of the browser.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
