<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';

const props = withDefaults(defineProps<{ keepMounted?: boolean; hiddenUntilFound?: boolean }>(), {
  keepMounted: undefined,
  hiddenUntilFound: undefined,
});
</script>

<template>
  <Accordion.Panel v-bind="props"><slot /></Accordion.Panel>
</template>
