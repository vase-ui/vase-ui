<script setup lang="ts">
import WrapperCast from './WrapperCast.test.vue';

defineProps<{ open?: boolean }>();
</script>

<template>
  <WrapperCast :open="open" :close-on-select="false"><slot /></WrapperCast>
</template>
