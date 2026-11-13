<script setup lang="ts">
import CompositeItemPart from '../../../../test/fixtures/CompositeItemPart.vue';
import CompositeRootPart from '../../../../test/fixtures/CompositeRootPart.vue';
import CompositeItemAsyncBranch from './CompositeItemAsyncBranch.test.vue';
</script>

<template>
  <CompositeRootPart>
    <CompositeItemPart data-testid="a" disabled aria-disabled="true" />
    <Suspense>
      <div>
        <CompositeItemPart data-testid="b" />
        <CompositeItemAsyncBranch />
      </div>
    </Suspense>
    <CompositeItemPart data-testid="c" />
  </CompositeRootPart>
</template>
