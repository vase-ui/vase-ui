<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';
import { useForwardProps } from '../use-forward-props';

const props = defineProps<{ keepMounted?: boolean; hiddenUntilFound?: boolean; id?: string }>();
const forwarded = useForwardProps(props);
defineExpose({ forwarded });
</script>

<template>
  <Accordion.Panel v-bind="forwarded"><slot /></Accordion.Panel>
</template>
