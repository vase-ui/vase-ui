<script setup vapor lang="ts">
import { useRender } from './useRender';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  as?: string | undefined;
  report: (element: HTMLElement | null) => void;
}>();

const { element, elementProps, setRef, tag } = useRender(props, {
  ref: (value) => {
    props.report(value);
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="{}" />
  <component :is="tag" v-else v-bind="elementProps()" :ref="setRef"><slot /></component>
</template>
