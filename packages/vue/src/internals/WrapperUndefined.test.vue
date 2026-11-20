<script setup lang="ts">
import { Menubar } from '@vase-ui/vue/menubar';

const props = withDefaults(defineProps<{ modal?: boolean; loopFocus?: boolean }>(), {
  modal: undefined,
  loopFocus: undefined,
});
</script>

<template>
  <Menubar v-bind="props"><slot /></Menubar>
</template>
