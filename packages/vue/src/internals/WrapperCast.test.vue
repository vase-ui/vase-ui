<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';

defineProps<{ keepMounted?: boolean; hiddenUntilFound?: boolean }>();
</script>

<template>
  <Accordion.Panel :keep-mounted="keepMounted" :hidden-until-found="hiddenUntilFound">
    <slot />
  </Accordion.Panel>
</template>
