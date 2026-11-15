<script lang="ts">
import { defineAsyncComponent } from 'vue';
import CompositeItemPart from '../../../../test/fixtures/CompositeItemPart.vue';

let release: (() => void) | undefined;

// A browser loads the component when a test calls this function.
export function releaseAsyncComponent() {
  release?.();
}

// The module makes the component of a server one time, as a lazy component of Nuxt is made. After
// its first render, a server has the component loaded and runs its `setup` in the order of the
// document.
const ServerAsyncCompositeItem = defineAsyncComponent(() => Promise.resolve(CompositeItemPart));
</script>

<script setup lang="ts">
import CompositeRootPart from '../../../../test/fixtures/CompositeRootPart.vue';

// A browser has not loaded the component when the page hydrates, so it runs that `setup` after the
// later items. Vue keeps a loaded component, so each mount in a browser makes a new one.
const AsyncCompositeItem =
  typeof document === 'undefined'
    ? ServerAsyncCompositeItem
    : defineAsyncComponent(
        () =>
          new Promise<typeof CompositeItemPart>((resolve) => {
            release = () => resolve(CompositeItemPart);
          }),
      );
</script>

<template>
  <CompositeRootPart>
    <CompositeItemPart data-testid="a" disabled aria-disabled="true" />
    <AsyncCompositeItem data-testid="b" />
    <CompositeItemPart data-testid="c" />
  </CompositeRootPart>
</template>
