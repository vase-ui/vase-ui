<script setup vapor lang="ts">
import { useRenderElement } from './useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    as?: string | undefined;
    report: (element: HTMLElement | null) => void;
  }>(),
  { as: 'div' },
);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  ref: (value) => {
    props.report(value);
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="{}" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef"><slot /></component>
</template>
