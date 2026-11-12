<script setup lang="ts">
import { inject } from 'vue';
import { markChildrenMounted } from '../../src/internals/useRenderElement';
import { CHILDREN_PART_STATE } from './ChildrenPartContext';

const state = inject(CHILDREN_PART_STATE);

if (!state) {
  throw new Error(
    'Vase UI: <ChildrenPartChildren> must be inside <ChildrenPart>. Without a part it has no state to show. Mount it in the `children` slot prop of <ChildrenPart>.',
  );
}

markChildrenMounted();
</script>

<template>
  <slot />
  <span data-children-part-node>{{ state.value }}</span>
</template>
