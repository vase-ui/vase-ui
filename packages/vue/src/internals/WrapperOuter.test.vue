<script setup lang="ts">
import WrapperCast from './WrapperCast.test.vue';

defineProps<{ keepMounted?: boolean }>();
</script>

<template>
  <WrapperCast :keep-mounted="keepMounted" :hidden-until-found="false"><slot /></WrapperCast>
</template>
