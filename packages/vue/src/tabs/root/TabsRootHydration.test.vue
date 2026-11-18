<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { Tabs } from '@vase-ui/vue/tabs';

const props = withDefaults(
  defineProps<{
    value?: string | number | null;
    defaultValue?: string | number | null;
    orientation?: 'horizontal' | 'vertical';
    numeric?: boolean;
    firstDisabled?: boolean;
    panel?: 'none' | 'before' | 'after';
    ids?: boolean;
    removedAtMount?: 'none' | 'list' | 'panel';
  }>(),
  {
    value: undefined,
    defaultValue: undefined,
    orientation: 'horizontal',
    panel: 'none',
    ids: true,
    removedAtMount: 'none',
  },
);

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});
const removed = computed(() => (isMounted.value ? props.removedAtMount : 'none'));
</script>

<template>
  <Tabs.Root
    :model-value="value"
    :default-value="defaultValue"
    :orientation="orientation"
    data-testid="root"
  >
    <Tabs.Panel
      v-if="panel === 'before' && removed !== 'panel'"
      :value="numeric ? 0 : 'a'"
      :id="ids ? 'panel-a' : undefined"
      data-testid="panel-a"
    />
    <Tabs.List v-if="removed !== 'list'">
      <Tabs.Tab
        :value="numeric ? 0 : 'a'"
        :disabled="firstDisabled"
        :id="ids ? 'tab-a' : undefined"
        data-testid="a"
      >
        A
      </Tabs.Tab>
      <Tabs.Tab :value="numeric ? 1 : 'b'" data-testid="b">B</Tabs.Tab>
      <Tabs.Tab :value="numeric ? 2 : 'c'" data-testid="c">C</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel
      v-if="panel === 'after' && removed !== 'panel'"
      :value="numeric ? 0 : 'a'"
      :id="ids ? 'panel-a' : undefined"
      data-testid="panel-a"
    />
  </Tabs.Root>
</template>
