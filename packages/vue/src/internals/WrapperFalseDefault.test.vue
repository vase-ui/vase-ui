<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';

const props = withDefaults(defineProps<{ keepMounted?: boolean }>(), { keepMounted: false });
</script>

<template>
  <Accordion.Panel v-bind="props"><slot /></Accordion.Panel>
</template>
