<script setup lang="ts">
import WrapperCast from './WrapperCast.test.vue';

defineProps<{ modal?: boolean }>();
</script>

<template>
  <WrapperCast :modal="modal" :loop-focus="false"><slot /></WrapperCast>
</template>
