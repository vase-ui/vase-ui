<script setup lang="ts">
import { Tabs } from '@vuetify/v0';
</script>

<template>
  <Tabs.Root>
    <Tabs.List>
      <Tabs.Item value="1">Tab 1</Tabs.Item>
      <Tabs.Item value="2">Tab 2</Tabs.Item>
      <Tabs.Item value="3">Tab 3</Tabs.Item>
    </Tabs.List>
    <Tabs.Panel value="1">Panel 1</Tabs.Panel>
    <Tabs.Panel value="2">Panel 2</Tabs.Panel>
    <Tabs.Panel value="3">Panel 3</Tabs.Panel>
  </Tabs.Root>
</template>
