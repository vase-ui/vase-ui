<script setup lang="ts">
import { useRender } from '@vase-ui/vue/use-render';
import type { UseRenderComponentProps } from '@vase-ui/vue/use-render';

defineOptions({ inheritAttrs: false });

const props = defineProps<UseRenderComponentProps>();

// #region usage
const { element, elementProps, tag } = useRender(props, {
  // Parameters
});
// #endregion usage

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="{}" />
  <component :is="tag" v-else v-bind="elementProps()"><slot /></component>
</template>
