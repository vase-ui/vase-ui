<script setup lang="ts">
import { Tabs } from '@vase-ui/vue/tabs';
</script>

<template>
  <Tabs.Root default-value="overview">
    <Tabs.List>
      <Tabs.Tab value="overview">
        <template #element="{ props, elementRef }">
          <a v-bind="props" :ref="elementRef" href="#overview">Overview</a>
        </template>
      </Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="overview">Workspace stats and activity.</Tabs.Panel>
  </Tabs.Root>
</template>
