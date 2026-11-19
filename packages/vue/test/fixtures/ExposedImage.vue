<script setup lang="ts">
import { useTemplateRef } from 'vue';

defineProps({ picture: String });
const element = useTemplateRef('element');
defineExpose({ element });
</script>

<template>
  <img ref="element" alt="" :src="picture" />
</template>
