<script setup lang="ts">
import { useRender } from '@vase-ui/vue/use-render';
import type { UseRenderComponentProps } from '@vase-ui/vue/use-render';

const props = defineProps<UseRenderComponentProps>();

// #region usage
const { element, elementProps, tag } = useRender(props, {
  // Parameters
});
// #endregion usage

defineExpose({ element });
</script>

<template>
  <component :is="tag" v-bind="elementProps()" />
</template>
