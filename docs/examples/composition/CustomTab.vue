<script setup lang="ts">
import { Tabs } from '@vase-ui/vue/tabs';
import MyButton from './MyButton.vue';
</script>

<template>
  <Tabs.Root default-value="overview">
    <Tabs.List>
      <Tabs.Tab value="overview" :as="MyButton">Overview</Tabs.Tab>
      <Tabs.Tab value="activity">
        <template #element="{ props, elementRef }">
          <MyButton v-bind="props" :ref="elementRef" size="lg">Activity</MyButton>
        </template>
      </Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="overview">Workspace stats.</Tabs.Panel>
    <Tabs.Panel value="activity">Recent activity.</Tabs.Panel>
  </Tabs.Root>
</template>
