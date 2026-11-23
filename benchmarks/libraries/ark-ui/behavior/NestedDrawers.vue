<script setup lang="ts">
import { Drawer } from '@ark-ui/vue/drawer';
import { ref } from 'vue';
import '../../../behavior/style.css';
import '../../../behavior/drawers.css';

const drawerCount = ref(0);
</script>

<template>
  <div class="bench-page">
    <Drawer.Root>
      <Drawer.Trigger data-bench="drawer-1-trigger">Open drawer 1</Drawer.Trigger>
      <Drawer.Backdrop class="bench-backdrop" />
      <Drawer.Positioner class="drawer-positioner">
        <Drawer.Content data-bench="drawer-1" class="drawer-content">
          <Drawer.Grabber data-bench="drawer-1-handle" class="drawer-grabber">
            <Drawer.GrabberIndicator />
          </Drawer.Grabber>
          <div class="bench-drawer-row">
            <button type="button" data-bench="drawer-1-action" @click="drawerCount++">
              Drawer 1 action
            </button>
            <span data-bench="drawer-1-count">{{ drawerCount }}</span>
            <Drawer.Root>
              <Drawer.Trigger data-bench="drawer-2-trigger">Open drawer 2</Drawer.Trigger>
              <Drawer.Backdrop class="bench-backdrop" />
              <Drawer.Positioner class="drawer-positioner">
                <Drawer.Content data-bench="drawer-2" class="drawer-content">
                  <Drawer.Grabber data-bench="drawer-2-handle" class="drawer-grabber">
                    <Drawer.GrabberIndicator />
                  </Drawer.Grabber>
                  <div class="bench-drawer-row">
                    <button type="button" data-bench="drawer-2-action">Drawer 2 action</button>
                    <Drawer.CloseTrigger>Close</Drawer.CloseTrigger>
                  </div>
                  <Drawer.Title class="bench-drawer-title">Drawer 2</Drawer.Title>
                  <Drawer.Description class="bench-drawer-description">
                    Description 2
                  </Drawer.Description>
                </Drawer.Content>
              </Drawer.Positioner>
            </Drawer.Root>
            <Drawer.CloseTrigger>Close</Drawer.CloseTrigger>
          </div>
          <Drawer.Title class="bench-drawer-title">Drawer 1</Drawer.Title>
          <Drawer.Description class="bench-drawer-description">Description 1</Drawer.Description>
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
