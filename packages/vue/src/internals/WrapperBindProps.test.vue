<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';

const props = defineProps<{ keepMounted?: boolean; hiddenUntilFound?: boolean }>();
</script>

<template>
  <Accordion.Panel v-bind="props"><slot /></Accordion.Panel>
</template>
