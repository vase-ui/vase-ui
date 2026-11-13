<script lang="ts">
import { defineAsyncComponent } from 'vue';
import CompositeItemPart from '../../../../test/fixtures/CompositeItemPart.vue';

let release: (() => void) | undefined;

// A browser loads the component when a test calls this function. A server has no test that can
// release it, so its loader resolves at once.
export function releaseAsyncComponent() {
  release?.();
}

// The module makes the component one time, as a lazy component of Nuxt is made. After its first
// render, a server has the component loaded and runs its `setup` in the order of the document.
// A browser has not loaded it when the page hydrates, so it runs that `setup` after the later items.
// Thus only one case of a test file can see the component before it is loaded.
const AsyncCompositeItem = defineAsyncComponent(() =>
  typeof document === 'undefined'
    ? Promise.resolve(CompositeItemPart)
    : new Promise<typeof CompositeItemPart>((resolve) => {
        release = () => resolve(CompositeItemPart);
      }),
);
</script>

<script setup lang="ts">
import CompositeRootPart from '../../../../test/fixtures/CompositeRootPart.vue';
</script>

<template>
  <CompositeRootPart>
    <CompositeItemPart data-testid="a" disabled aria-disabled="true" />
    <AsyncCompositeItem data-testid="b" />
    <CompositeItemPart data-testid="c" />
  </CompositeRootPart>
</template>
