<script lang="ts">
import type { DrawerVisualState, DrawerVisualStateStore } from './DrawerProviderContext';

export interface DrawerProviderState {}

export interface DrawerProviderProps {}

type VisualStateListener = () => void;

function createVisualStateStore(): DrawerVisualStateStore {
  let state: DrawerVisualState = {
    swipeProgress: 0,
    frontmostHeight: 0,
  };
  const listeners = new Set<VisualStateListener>();

  return {
    getSnapshot: () => state,
    set(nextState) {
      let nextSwipeProgress = state.swipeProgress;
      if (nextState.swipeProgress !== undefined) {
        nextSwipeProgress = Number.isFinite(nextState.swipeProgress) ? nextState.swipeProgress : 0;
      }

      let nextFrontmostHeight = state.frontmostHeight;
      if (nextState.frontmostHeight !== undefined) {
        nextFrontmostHeight = Number.isFinite(nextState.frontmostHeight)
          ? nextState.frontmostHeight
          : 0;
      }

      if (
        nextSwipeProgress === state.swipeProgress &&
        nextFrontmostHeight === state.frontmostHeight
      ) {
        return;
      }

      state = {
        swipeProgress: nextSwipeProgress,
        frontmostHeight: nextFrontmostHeight,
      };

      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
</script>

<script setup lang="ts">
import { provide, shallowRef } from 'vue';
import { DrawerProviderContext } from './DrawerProviderContext';

defineSlots<{ default?: () => unknown }>();

const openDrawers = new Set<object>();
const active = shallowRef(false);

function setDrawerOpen(drawer: object, open: boolean) {
  if (openDrawers.has(drawer) === open) {
    return;
  }

  if (open) {
    openDrawers.add(drawer);
  } else {
    openDrawers.delete(drawer);
  }
  active.value = openDrawers.size > 0;
}

function removeDrawer(drawer: object) {
  setDrawerOpen(drawer, false);
}

provide(DrawerProviderContext, {
  setDrawerOpen,
  removeDrawer,
  active,
  visualStateStore: createVisualStateStore(),
});
</script>

<template>
  <slot />
</template>
