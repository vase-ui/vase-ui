<script setup lang="ts">
import type { PropType } from 'vue';
import { Collapsible } from '../../src/collapsible';

// The panel has a scoped class and `v-show`.
defineProps({
  scene: { type: Object as PropType<{ shown: boolean }>, default: () => ({ shown: true }) },
});
</script>

<template>
  <Collapsible.Root default-open>
    <Collapsible.Panel v-show="scene.shown" class="Scoped">Content</Collapsible.Panel>
  </Collapsible.Root>
</template>

<style scoped>
.Scoped {
  outline-width: 3px;
}
</style>
