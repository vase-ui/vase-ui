<script setup lang="ts">
import type { PropType } from 'vue';
import { Tabs } from '../../src/tabs';

// A list with no root, or a tab or an indicator in a root with no list.
defineProps({
  part: { type: String as PropType<'list' | 'tab' | 'indicator'>, required: true },
});
</script>

<template>
  <Tabs.List v-if="part === 'list'" />
  <Tabs.Root v-else>
    <Tabs.Tab v-if="part === 'tab'" value="a" />
    <Tabs.Indicator v-else />
  </Tabs.Root>
</template>
