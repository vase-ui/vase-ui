<script setup lang="ts">
import type { PropType } from 'vue';
import { Toolbar } from '../../src/toolbar';

defineProps({
  part: {
    type: String as PropType<'group' | 'button' | 'input' | 'link' | 'separator'>,
    required: true,
  },
});
</script>

<template>
  <Toolbar.Group v-if="part === 'group'" />
  <Toolbar.Button v-else-if="part === 'button'" />
  <Toolbar.Input v-else-if="part === 'input'" />
  <Toolbar.Link v-else-if="part === 'link'" />
  <Toolbar.Separator v-else />
</template>
