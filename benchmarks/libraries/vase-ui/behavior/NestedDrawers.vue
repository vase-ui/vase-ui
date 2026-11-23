<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
import { ref } from 'vue';
import '../../../behavior/style.css';
import '../../../behavior/drawers.css';

const drawerCount = ref(0);
</script>

<template>
  <div class="bench-page">
    <Drawer.Root>
      <Drawer.Trigger data-bench="drawer-1-trigger">Open drawer 1</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop class="bench-backdrop" />
        <Drawer.Viewport class="drawer-viewport">
          <Transition
            enter-from-class="drawer-hidden"
            leave-to-class="drawer-hidden"
            leave-active-class="drawer-leaving"
            appear
          >
            <Drawer.Popup data-bench="drawer-1" class="drawer-popup">
              <div data-bench="drawer-1-handle" />
              <Drawer.Content>
                <div class="bench-drawer-row">
                  <button type="button" data-bench="drawer-1-action" @click="drawerCount++">
                    Drawer 1 action
                  </button>
                  <span data-bench="drawer-1-count">{{ drawerCount }}</span>
                  <Drawer.Root>
                    <Drawer.Trigger data-bench="drawer-2-trigger">Open drawer 2</Drawer.Trigger>
                    <Drawer.Portal>
                      <Drawer.Viewport class="drawer-viewport">
                        <Transition
                          enter-from-class="drawer-hidden"
                          leave-to-class="drawer-hidden"
                          leave-active-class="drawer-leaving"
                          appear
                        >
                          <Drawer.Popup data-bench="drawer-2" class="drawer-popup">
                            <div data-bench="drawer-2-handle" />
                            <Drawer.Content>
                              <div class="bench-drawer-row">
                                <button type="button" data-bench="drawer-2-action">
                                  Drawer 2 action
                                </button>
                                <Drawer.Close>Close</Drawer.Close>
                              </div>
                              <Drawer.Title class="bench-drawer-title">Drawer 2</Drawer.Title>
                              <Drawer.Description class="bench-drawer-description">
                                Description 2
                              </Drawer.Description>
                            </Drawer.Content>
                          </Drawer.Popup>
                        </Transition>
                      </Drawer.Viewport>
                    </Drawer.Portal>
                  </Drawer.Root>
                  <Drawer.Close>Close</Drawer.Close>
                </div>
                <Drawer.Title class="bench-drawer-title">Drawer 1</Drawer.Title>
                <Drawer.Description class="bench-drawer-description">
                  Description 1
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
/* The motion of the nested drawer example of the docs, with no stack look. */
.drawer-viewport {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.drawer-popup {
  position: relative;
  transition: transform 450ms cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform;
  transform: translateY(var(--drawer-swipe-movement-y));
}

.drawer-popup[data-swiping] {
  transition-duration: 0ms;
}

.drawer-popup.drawer-hidden {
  transform: translateY(calc(100% + 2px));
}

.drawer-popup.drawer-leaving {
  transition-duration: calc(var(--drawer-swipe-strength) * 400ms);
}
</style>
