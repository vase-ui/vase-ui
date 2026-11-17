<script setup lang="ts">
import { Tabs } from '../index';

withDefaults(defineProps<{ renderBeforeHydration?: boolean }>(), {
  renderBeforeHydration: undefined,
});
</script>

<template>
  <Tabs.Root default-value="a">
    <Tabs.List>
      <Tabs.Tab value="a">A</Tabs.Tab>
      <Tabs.Indicator
        class="indicator"
        data-testid="indicator"
        :render-before-hydration="renderBeforeHydration"
      />
    </Tabs.List>
  </Tabs.Root>
</template>

<style scoped>
.indicator {
  outline-style: dashed;
}
</style>
