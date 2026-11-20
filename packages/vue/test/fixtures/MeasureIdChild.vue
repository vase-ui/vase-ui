<script setup lang="ts">
import { useId } from 'vue';

const id = useId();
</script>

<template>
  <span :id="id" />
</template>
