<script setup lang="ts">
import { Tabs } from '@vase-ui/vue/tabs';

defineProps<{ defaultValue: string }>();
</script>

<template>
  <Tabs.Root :default-value="defaultValue">
    <Tabs.List>
      <Tabs.Tab value="a">A</Tabs.Tab>
      <Tabs.Tab value="b">B</Tabs.Tab>
      <Tabs.Tab value="c">C</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="a" data-testid="a">Panel A</Tabs.Panel>
    <Tabs.Panel value="b" keep-mounted data-testid="b">Panel B</Tabs.Panel>
    <Tabs.Panel value="c" data-testid="c">Panel C</Tabs.Panel>
  </Tabs.Root>
</template>
