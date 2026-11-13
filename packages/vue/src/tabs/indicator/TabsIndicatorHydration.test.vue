<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { Tabs } from '@vase-ui/vue/tabs';

withDefaults(
  defineProps<{
    value?: string | null;
    renderBeforeHydration?: boolean;
    styled?: boolean;
    late?: boolean;
  }>(),
  { value: 'b' },
);

// The indicator of an async component in `<Suspense>` hydrates after its list.
const AsyncIndicator = defineAsyncComponent(() => Promise.resolve(Tabs.Indicator));
</script>

<template>
  <Tabs.Root :value="value">
    <Tabs.List style="display: flex; position: relative; width: 300px">
      <Tabs.Tab value="a" style="width: 100px; height: 40px; padding: 0; border: 0">A</Tabs.Tab>
      <Tabs.Tab value="b" style="width: 100px; height: 40px; padding: 0; border: 0">B</Tabs.Tab>
      <Suspense v-if="late">
        <AsyncIndicator
          data-testid="indicator"
          :render-before-hydration="renderBeforeHydration"
          :style="styled ? 'height: 3px' : undefined"
        />
      </Suspense>
      <Tabs.Indicator
        v-else
        data-testid="indicator"
        :render-before-hydration="renderBeforeHydration"
        :style="styled ? 'height: 3px' : undefined"
      />
    </Tabs.List>
  </Tabs.Root>
</template>
