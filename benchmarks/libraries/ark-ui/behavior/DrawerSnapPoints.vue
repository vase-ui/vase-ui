<script setup lang="ts">
import { Drawer } from '@ark-ui/vue/drawer';
import '../../../behavior/style.css';
import '../../../behavior/drawers.css';

// The docs give a snap point as a fraction of the viewport height, which is 720 pixels in a run.
const snapPoints = [240 / 720, 480 / 720];
</script>

<template>
  <div class="bench-page">
    <Drawer.Root :snap-points="snapPoints" :default-snap-point="480 / 720">
      <Drawer.Trigger data-bench="drawer-trigger">Open drawer</Drawer.Trigger>
      <Drawer.Backdrop class="bench-backdrop" />
      <Drawer.Positioner class="drawer-positioner">
        <Drawer.Content data-bench="drawer" class="drawer-content">
          <Drawer.Grabber data-bench="drawer-handle" class="drawer-grabber">
            <Drawer.GrabberIndicator />
          </Drawer.Grabber>
          <div class="bench-drawer-row">
            <Drawer.CloseTrigger>Close</Drawer.CloseTrigger>
          </div>
          <Drawer.Title class="bench-drawer-title">Drawer</Drawer.Title>
          <Drawer.Description class="bench-drawer-description">Description</Drawer.Description>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  </div>
</template>

<style>
/* The motion of the drawer example of the docs, at the bottom edge. */
.drawer-positioner {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.drawer-content {
  position: relative;
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  animation-duration: 0.5s;
  animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
}

.drawer-grabber {
  touch-action: none;
  user-select: none;
}

.drawer-content[data-state='open'] {
  animation-name: slide-in-bottom;
}

.drawer-content[data-state='closed'] {
  animation: slide-out-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slide-in-bottom {
  from {
    transform: translate3d(0, 100%, 0);
  }

  to {
    transform: translate3d(var(--drawer-translate-x, 0), var(--drawer-translate-y, 0), 0);
  }
}

@keyframes slide-out-bottom {
  from {
    transform: translate3d(var(--drawer-translate-x, 0), var(--drawer-translate-y, 0), 0);
  }

  to {
    transform: translate3d(0, 100%, 0);
  }
}
</style>
