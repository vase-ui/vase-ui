<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Separator } from '../../src/separator';

defineProps({
  separators: { type: Array as PropType<Record<string, unknown>[]>, required: true },
});
const parts = useTemplateRef('parts');
defineExpose({ parts });
</script>

<template>
  <Separator v-for="(attrs, index) in separators" :key="index" ref="parts" v-bind="attrs" />
</template>
