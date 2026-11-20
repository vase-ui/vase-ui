<script setup lang="ts">
import type { PropType } from 'vue';
import { Accordion } from '../../src/accordion';

// An item with no root, or a header, a trigger or a panel in a root with no item.
defineProps({
  part: { type: String as PropType<'item' | 'header' | 'trigger' | 'panel'>, required: true },
});
</script>

<template>
  <Accordion.Item v-if="part === 'item'" />
  <Accordion.Root v-else>
    <Accordion.Header v-if="part === 'header'" />
    <Accordion.Trigger v-else-if="part === 'trigger'" />
    <Accordion.Panel v-else />
  </Accordion.Root>
</template>
