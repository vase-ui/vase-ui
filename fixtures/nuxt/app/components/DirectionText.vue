<script setup lang="ts">
import { useDirection } from '@vase-ui/vue/direction-provider';

const direction = useDirection();
</script>

<template>
  <span>{{ direction }}</span>
</template>
