<script setup lang="ts">
import type { PropType } from 'vue';
import { Collapsible } from '../../src/collapsible';

// A trigger or a panel with no root.
defineProps({ part: { type: String as PropType<'trigger' | 'panel'>, required: true } });
</script>

<template>
  <Collapsible.Trigger v-if="part === 'trigger'" />
  <Collapsible.Panel v-else />
</template>
