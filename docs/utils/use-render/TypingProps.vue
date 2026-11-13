<script lang="ts">
import type { UseRenderComponentProps, UseRenderElementProps } from '@vase-ui/vue/use-render';

export interface ButtonProps
  extends UseRenderComponentProps, /* @vue-ignore */ UseRenderElementProps<'button'> {}
</script>

<script setup lang="ts">
import { mergeProps } from '@vase-ui/vue/merge-props';
import { useRender } from '@vase-ui/vue/use-render';

defineOptions({ inheritAttrs: false });

const props = defineProps<ButtonProps>();

defineSlots<{
  default(): unknown;
  render: useRender.RenderProp;
}>();

const defaultProps: useRender.ElementProps<'button'> = {
  class: 'button',
  type: 'button',
};

const { element, elementProps, tag } = useRender(props, {
  defaultTagName: 'button',
  props: (attrs) => mergeProps<'button'>(defaultProps, attrs),
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="{}" />
  <component :is="tag" v-else v-bind="elementProps()"><slot>Click me</slot></component>
</template>
