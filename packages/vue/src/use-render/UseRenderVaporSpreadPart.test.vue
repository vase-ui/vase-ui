<script setup vapor lang="ts">
import { useRender } from './useRender';

defineOptions({ inheritAttrs: false });

const props = defineProps<{ as?: string | undefined; shown: boolean }>();

const { element, elementProps, tag } = useRender(props);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="{}" />
  <component :is="tag" v-else-if="shown" v-bind="elementProps()"><slot /></component>
</template>
