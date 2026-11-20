<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

// One part with no root.
defineProps({
  part: { type: String as PropType<'Icon' | 'Item'>, required: true },
});
</script>

<template>
  <component :is="Combobox[part]" />
</template>
