<script lang="ts">
import { defineAsyncComponent } from 'vue';
import CompositeItemPart from '../../../../test/fixtures/CompositeItemPart.vue';

// The module makes the component one time, as a lazy component of Nuxt is made. After its first
// render, a server has the component loaded and runs its `setup` in the order of the document.
// A browser has not loaded it when the page hydrates, so it runs that `setup` after the later items.
const AsyncCompositeItem = defineAsyncComponent(() => Promise.resolve(CompositeItemPart));
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
