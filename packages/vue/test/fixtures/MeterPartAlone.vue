<script setup lang="ts">
import type { PropType } from 'vue';
import { Meter } from '../../src/meter';

defineProps({
  part: { type: String as PropType<'Label' | 'Value' | 'Track' | 'Indicator'>, required: true },
});
</script>

<template>
  <component :is="Meter[part]" />
</template>
