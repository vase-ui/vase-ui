<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';

defineProps<{ keepMounted?: boolean }>();
</script>

<template>
  <Accordion.Item>
    <Accordion.Panel :keep-mounted="keepMounted"><slot /></Accordion.Panel>
  </Accordion.Item>
</template>
