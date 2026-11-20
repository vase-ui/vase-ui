<script setup lang="ts">
import { Menubar } from '@vase-ui/vue/menubar';

defineProps<{ modal?: boolean; loopFocus?: boolean }>();
</script>

<template>
  <Menubar :modal="modal" :loop-focus="loopFocus">
    <slot />
  </Menubar>
</template>
