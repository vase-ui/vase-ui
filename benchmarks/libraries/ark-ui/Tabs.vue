<script setup lang="ts">
import { Tabs } from '@ark-ui/vue/tabs';
</script>

<template>
  <Tabs.Root default-value="tab-1">
    <Tabs.List>
      <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
      <Tabs.Trigger value="tab-2">Tab 2</Tabs.Trigger>
      <Tabs.Trigger value="tab-3">Tab 3</Tabs.Trigger>
      <Tabs.Indicator />
    </Tabs.List>
    <Tabs.Content value="tab-1">Panel 1</Tabs.Content>
    <Tabs.Content value="tab-2">Panel 2</Tabs.Content>
    <Tabs.Content value="tab-3">Panel 3</Tabs.Content>
  </Tabs.Root>
</template>
