<script setup lang="ts">
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue';
</script>

<template>
  <TabGroup>
    <TabList>
      <Tab>Tab 1</Tab>
      <Tab>Tab 2</Tab>
      <Tab>Tab 3</Tab>
    </TabList>
    <TabPanels>
      <TabPanel>Panel 1</TabPanel>
      <TabPanel>Panel 2</TabPanel>
      <TabPanel>Panel 3</TabPanel>
    </TabPanels>
  </TabGroup>
</template>
