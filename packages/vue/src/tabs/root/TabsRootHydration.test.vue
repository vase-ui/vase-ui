<script setup lang="ts">
import { Tabs } from '@vase-ui/vue/tabs';
import TabsPanelProbe from './TabsPanelProbe.test.vue';

withDefaults(
  defineProps<{
    value?: string | number | null;
    defaultValue?: string | number | null;
    orientation?: 'horizontal' | 'vertical';
    numeric?: boolean;
    firstDisabled?: boolean;
    panel?: 'none' | 'before' | 'after';
  }>(),
  { value: undefined, defaultValue: undefined, orientation: 'horizontal', panel: 'none' },
);
</script>

<template>
  <Tabs.Root
    :value="value"
    :default-value="defaultValue"
    :orientation="orientation"
    data-testid="root"
  >
    <TabsPanelProbe v-if="panel === 'before'" :value="numeric ? 0 : 'a'" id="panel-a" />
    <Tabs.List>
      <Tabs.Tab :value="numeric ? 0 : 'a'" :disabled="firstDisabled" id="tab-a" data-testid="a">
        A
      </Tabs.Tab>
      <Tabs.Tab :value="numeric ? 1 : 'b'" data-testid="b">B</Tabs.Tab>
      <Tabs.Tab :value="numeric ? 2 : 'c'" data-testid="c">C</Tabs.Tab>
    </Tabs.List>
    <TabsPanelProbe v-if="panel === 'after'" :value="numeric ? 0 : 'a'" id="panel-a" />
  </Tabs.Root>
</template>
