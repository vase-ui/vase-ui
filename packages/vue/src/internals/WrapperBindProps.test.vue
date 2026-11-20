<script setup lang="ts">
import { Menubar } from '@vase-ui/vue/menubar';

const props = defineProps<{ modal?: boolean; loopFocus?: boolean }>();
</script>

<template>
  <Menubar v-bind="props"><slot /></Menubar>
</template>
