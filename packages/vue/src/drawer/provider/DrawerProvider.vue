<script lang="ts">
import type { DrawerVisualState } from './DrawerProviderContext';

export interface DrawerProviderState {}

export interface DrawerProviderProps {}
</script>

<script setup lang="ts">
import { computed, provide, shallowReactive } from 'vue';
import { DrawerProviderContext } from './DrawerProviderContext';

defineSlots<{ default?: () => unknown }>();

const openDrawers = shallowReactive(new Set<object>());
let visualOwner: object | undefined;

function setDrawerOpen(drawer: object, open: boolean) {
  if (open) {
    openDrawers.add(drawer);
  } else {
    openDrawers.delete(drawer);
  }
}

const context = shallowReactive({
  active: computed(() => openDrawers.size > 0),
  setDrawerOpen,
  removeDrawer: (drawer: object) => openDrawers.delete(drawer),
  visualState: { swipeProgress: 0, frontmostHeight: 0 },
  setVisualState(next: Partial<DrawerVisualState>, owner?: object) {
    const current = context.visualState;
    const progress = next.swipeProgress ?? current.swipeProgress;
    const height = next.frontmostHeight ?? current.frontmostHeight;
    const swipeProgress = Number.isFinite(progress) ? progress : 0;
    const frontmostHeight = Number.isFinite(height) ? height : 0;
    if (swipeProgress === 0 && frontmostHeight === 0 && owner !== visualOwner) {
      return;
    }
    visualOwner = swipeProgress || frontmostHeight ? owner : undefined;
    if (swipeProgress !== current.swipeProgress || frontmostHeight !== current.frontmostHeight) {
      context.visualState = { swipeProgress, frontmostHeight };
    }
  },
});
provide(DrawerProviderContext, context);
</script>

<template>
  <slot />
</template>
