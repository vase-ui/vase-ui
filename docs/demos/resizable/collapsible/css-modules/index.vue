<script setup lang="ts">
import { onMounted, shallowRef, useTemplateRef } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import CollapseButton from './CollapseButton.vue';
import styles from './index.module.css';

const sidebar = useTemplateRef('sidebar');
// The panels get their sizes at the mount. The transition starts two frames later, so that it
// does not animate them.
const animated = shallowRef(false);
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => (animated.value = true))));

function toggle(collapsed: boolean) {
  if (collapsed) sidebar.value?.expand();
  else sidebar.value?.collapse();
}
</script>

<template>
  <Resizable.Root :class="styles.Root">
    <Resizable.Panel
      id="sidebar"
      ref="sidebar"
      v-slot="{ state }"
      default-size="30"
      min-size="160px"
      collapsible
      collapsed-size="48px"
      :class="[styles.Sidebar, animated && styles.Animated]"
    >
      <div :class="styles.SidebarHeader">
        <CollapseButton
          :collapsed="state.collapsed"
          controls="sidebar"
          @toggle="toggle(state.collapsed)"
        />
        <p :class="styles.Label">Sidebar</p>
      </div>
    </Resizable.Panel>
    <Resizable.Handle aria-label="Resize the sidebar" :class="styles.Handle" />
    <Resizable.Panel id="main" :class="styles.Panel">
      <p :class="styles.Label">Main</p>
      <p :class="styles.Description">Drag the handle to the left, or press Enter on it.</p>
    </Resizable.Panel>
  </Resizable.Root>
</template>
