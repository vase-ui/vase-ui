<script setup lang="ts">
import { nextTick, onMounted, shallowRef, useTemplateRef } from 'vue';

defineOptions({ inheritAttrs: false });

const inner = useTemplateRef<HTMLSpanElement>('inner');
const element = shallowRef<HTMLSpanElement | null>(null);
defineExpose({ element });
onMounted(async () => {
  await nextTick();
  element.value = inner.value;
});
</script>

<!-- A component that exposes its element one tick after its mount. -->
<template>
  <div data-wrapper="">
    <span ref="inner" v-bind="$attrs"><slot /></span>
  </div>
</template>
