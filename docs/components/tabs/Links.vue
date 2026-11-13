<script setup lang="ts">
import { Tabs } from '@vase-ui/vue/tabs';
</script>

<template>
  <Tabs.Root default-value="overview">
    <Tabs.List>
      <Tabs.Tab :native-button="false" value="overview">
        <template #render="{ props }">
          <a v-bind="props" href="/overview">Overview</a>
        </template>
      </Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="overview">Workspace stats and activity.</Tabs.Panel>
  </Tabs.Root>
</template>
