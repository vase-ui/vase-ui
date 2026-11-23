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

const drawerCount = ref(0);
</script>

<template>
  <div class="bench-page">
    <DrawerRoot>
      <DrawerTrigger data-bench="drawer-1-trigger">Open drawer 1</DrawerTrigger>
      <DrawerPortal>
        <DrawerOverlay class="bench-backdrop" />
        <DrawerContent data-bench="drawer-1" class="drawer-content">
          <DrawerHandle data-bench="drawer-1-handle" />
          <div class="bench-drawer-row">
            <button type="button" data-bench="drawer-1-action" @click="drawerCount++">
              Drawer 1 action
            </button>
            <span data-bench="drawer-1-count">{{ drawerCount }}</span>
            <DrawerRoot>
              <DrawerTrigger data-bench="drawer-2-trigger">Open drawer 2</DrawerTrigger>
              <DrawerPortal>
                <DrawerOverlay class="bench-backdrop" />
                <DrawerContent data-bench="drawer-2" class="drawer-content">
                  <DrawerHandle data-bench="drawer-2-handle" />
                  <div class="bench-drawer-row">
                    <button type="button" data-bench="drawer-2-action">Drawer 2 action</button>
                    <DrawerClose>Close</DrawerClose>
                  </div>
                  <DrawerTitle class="bench-drawer-title">Drawer 2</DrawerTitle>
                  <DrawerDescription class="bench-drawer-description">
                    Description 2
                  </DrawerDescription>
                </DrawerContent>
              </DrawerPortal>
            </DrawerRoot>
            <DrawerClose>Close</DrawerClose>
          </div>
          <DrawerTitle class="bench-drawer-title">Drawer 1</DrawerTitle>
          <DrawerDescription class="bench-drawer-description">Description 1</DrawerDescription>
        </DrawerContent>
      </DrawerPortal>
    </DrawerRoot>
  </div>
</template>

<style>
/* The motion of "Animating the drawer" in the docs, at the bottom edge. */
.drawer-content {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  transform: translateY(var(--drawer-swipe-movement-y, 0px));
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
