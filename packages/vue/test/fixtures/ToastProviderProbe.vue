<script setup lang="ts">
import { watch } from 'vue';
import { injectToastProvider } from '../../src/toast/provider';

const props = defineProps({ addKey: { type: Number, default: 0 } });
const provider = injectToastProvider('the probe');
watch(
  () => props.addKey,
  (key) => provider.add({ id: `added-${key}` }),
);
defineExpose({ provider });
</script>

<template>
  <span />
</template>
