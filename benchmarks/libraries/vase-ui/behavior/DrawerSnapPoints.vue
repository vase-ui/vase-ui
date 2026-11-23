<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
import { shallowRef } from 'vue';
import '../../../behavior/style.css';
import '../../../behavior/drawers.css';

const snapPoints = ['240px', '480px'];
const snapPoint = shallowRef<Drawer.Root.SnapPoint | null>('480px');
</script>

<template>
  <div class="bench-page">
    <Drawer.Root v-model:snap-point="snapPoint" :snap-points="snapPoints">
      <Drawer.Trigger data-bench="drawer-trigger">Open drawer</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop class="bench-backdrop" />
        <Drawer.Viewport class="drawer-viewport">
          <Transition
            enter-from-class="drawer-hidden"
            leave-to-class="drawer-hidden"
            leave-active-class="drawer-leaving"
            appear
          >
            <Drawer.Popup data-bench="drawer" class="drawer-popup">
              <div data-bench="drawer-handle" />
              <Drawer.Content>
                <div class="bench-drawer-row">
                  <Drawer.Close>Close</Drawer.Close>
                </div>
                <Drawer.Title class="bench-drawer-title">Drawer</Drawer.Title>
                <Drawer.Description class="bench-drawer-description">
                  Description
                </Drawer.Description>
              </Drawer.Content>
            </Drawer.Popup>
          </Transition>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  </div>
</template>

<style>
/* The motion of the snap point example of the docs. */
.drawer-viewport {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  touch-action: none;
}

.drawer-popup {
  position: relative;
  touch-action: none;
  transition: transform 450ms cubic-bezier(0.32, 0.72, 0, 1);
  transform: translateY(calc(var(--drawer-snap-point-offset) + var(--drawer-swipe-movement-y)));
  will-change: transform;
}

.drawer-popup.drawer-hidden {
  transform: translateY(calc(100% + 2px));
}

.drawer-popup.drawer-leaving {
  transition-duration: calc(var(--drawer-swipe-strength) * 400ms);
}
</style>
