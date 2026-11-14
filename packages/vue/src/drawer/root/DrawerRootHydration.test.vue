<script setup lang="ts">
import { defineComponent, h } from 'vue';
import DrawerRoot from './DrawerRoot.vue';
import { useDrawerRootContext } from './DrawerRootContext';

const ActiveSnapPoint = defineComponent({
  setup() {
    const { activeSnapPoint } = useDrawerRootContext();
    return () => h('p', { 'data-testid': 'active' }, `active:${String(activeSnapPoint.value)}`);
  },
});
</script>

<template>
  <DrawerRoot
    v-slot="{ payload }"
    default-open
    :snap-points="['100px', '300px']"
    default-snap-point="300px"
  >
    <p data-testid="payload">{{ String(payload) }}</p>
    <ActiveSnapPoint />
    <DrawerRoot default-open :modal="false">
      <p>nested</p>
    </DrawerRoot>
  </DrawerRoot>
</template>
