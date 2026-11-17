<script setup vapor lang="ts">
import type { Component } from 'vue';
import { useRender } from './useRender';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  as?: string | Component | undefined;
  report: (element: HTMLElement | null) => void;
}>();

const { element, elementProps, setRef, tag, usesRenderSlot } = useRender(props, {
  ref: (value) => {
    props.report(value);
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="{}" />
  <component :is="tag" v-else v-bind="elementProps()" :ref="setRef"><slot /></component>
</template>
