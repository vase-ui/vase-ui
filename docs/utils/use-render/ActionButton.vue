<script lang="ts">
import type { UseRenderComponentProps, UseRenderElementProps } from '@vase-ui/vue/use-render';

export interface ActionButtonProps
  extends UseRenderComponentProps, /* @vue-ignore */ UseRenderElementProps<'button'> {}
</script>

<script setup lang="ts">
import { useRender } from '@vase-ui/vue/use-render';

defineOptions({ inheritAttrs: false });

const props = defineProps<ActionButtonProps>();

const { element, elementProps, tag } = useRender(props, { defaultTagName: 'button' });

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="{}" />
  <component :is="tag" v-else v-bind="elementProps()"><slot /></component>
</template>
