<script setup lang="ts">
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerOverlay,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
  DrawerTrigger,
} from 'reka-ui';
import { ref } from 'vue';
import '../../../behavior/style.css';
import '../../../behavior/drawers.css';

const snapPoints = ['240px', '480px'];
const activeSnapPoint = ref<string | number | null>('480px');
</script>

<template>
  <div class="bench-page">
    <DrawerRoot v-model:snap-point="activeSnapPoint" :snap-points="snapPoints">
      <DrawerTrigger data-bench="drawer-trigger">Open drawer</DrawerTrigger>
      <DrawerPortal>
        <DrawerOverlay class="bench-backdrop" />
        <DrawerContent data-bench="drawer" class="drawer-content">
          <DrawerHandle data-bench="drawer-handle" />
          <div class="bench-drawer-row">
            <DrawerClose>Close</DrawerClose>
          </div>
          <DrawerTitle class="bench-drawer-title">Drawer</DrawerTitle>
          <DrawerDescription class="bench-drawer-description">Description</DrawerDescription>
        </DrawerContent>
      </DrawerPortal>
    </DrawerRoot>
  </div>
</template>

<style>
/*
 * The motion of "Animating the drawer" in the docs, at the bottom edge, with the offset of the
 * active snap point that the docs name.
 */
.drawer-content {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  transform: translateY(
    calc(var(--drawer-snap-point-offset, 0px) + var(--drawer-swipe-movement-y, 0px))
  );
  transition: transform 450ms cubic-bezier(0.32, 0.72, 0, 1);
}

.drawer-content[data-state='open'] {
  animation: slideIn 450ms cubic-bezier(0.32, 0.72, 0, 1);
}

.drawer-content[data-state='closed'] {
  animation: slideOut 450ms cubic-bezier(0.32, 0.72, 0, 1);
}

.drawer-content[data-swiping] {
  transition-duration: 0ms;
}

@keyframes slideIn {
  from {
    translate: 0 100%;
  }
}

@keyframes slideOut {
  to {
    translate: 0 100%;
  }
}
</style>
