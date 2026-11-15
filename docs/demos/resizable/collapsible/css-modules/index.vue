<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
import CollapseButton from './CollapseButton.vue';
import styles from './index.module.css';
</script>

<template>
  <Resizable.Root :class="styles.Root">
    <Resizable.Panel
      id="sidebar"
      default-size="30"
      min-size="160px"
      collapsible
      collapsed-size="48px"
      :class="styles.Sidebar"
    >
      <div :class="styles.SidebarHeader">
        <CollapseButton />
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
