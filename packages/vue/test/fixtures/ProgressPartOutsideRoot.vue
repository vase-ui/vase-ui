<script setup lang="ts">
import type { PropType } from 'vue';
import { Progress } from '../../src/progress';

defineProps({
  part: { type: String as PropType<'Label' | 'Value' | 'Track' | 'Indicator'>, required: true },
});
</script>

<template>
  <component :is="Progress[part]" />
</template>
