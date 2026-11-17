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

const { element, elementProps, setRef } = useRenderElement('div', props, {
  ref: (value) => {
    props.report(value);
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="{}" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef"><slot /></component>
</template>
