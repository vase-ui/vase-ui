<script lang="ts">
import type { DrawerVisualState, DrawerVisualStateStore } from './DrawerProviderContext';

export interface DrawerProviderState {}

export interface DrawerProviderProps {}
</script>

<script setup lang="ts">
import { provide, shallowReactive, shallowRef } from 'vue';
import { DrawerProviderContext } from './DrawerProviderContext';

defineSlots<{ default?: () => unknown }>();

const visualState = shallowReactive<DrawerVisualState>({ swipeProgress: 0, frontmostHeight: 0 });
let visualOwner: object | undefined;

const visualStateStore: DrawerVisualStateStore = {
  state: visualState,
  set(next, owner) {
    const progress = next.swipeProgress ?? visualState.swipeProgress;
    const height = next.frontmostHeight ?? visualState.frontmostHeight;
    const swipeProgress = Number.isFinite(progress) ? progress : 0;
    const frontmostHeight = Number.isFinite(height) ? height : 0;
    if (swipeProgress === 0 && frontmostHeight === 0 && owner !== visualOwner) {
      return;
    }
    visualOwner = swipeProgress || frontmostHeight ? owner : undefined;
    visualState.frontmostHeight = frontmostHeight;
    visualState.swipeProgress = swipeProgress;
  },
};

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
  visualStateStore,
});
</script>

<template>
  <slot />
</template>
