<script setup lang="ts">
import { useTemplateRef } from 'vue';

defineOptions({ inheritAttrs: false });

const element = useTemplateRef('element');
defineExpose({ element });
</script>

<!-- A component whose root wraps the element that it exposes and that takes the attributes. -->
<template>
  <div data-wrapper="">
    <span ref="element" v-bind="$attrs"><slot /></span>
  </div>
</template>
