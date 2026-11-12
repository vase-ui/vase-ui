<script lang="ts">
import type { UseRenderComponentProps, UseRenderElementProps } from '@vase-ui/vue/use-render';

export interface TextProps
  extends UseRenderComponentProps, /* @vue-ignore */ UseRenderElementProps<'p'> {}
</script>

<script setup lang="ts">
import { shallowRef } from 'vue';
import { useRender } from '@vase-ui/vue/use-render';

defineOptions({ inheritAttrs: false });

const props = defineProps<TextProps>();

const internalElement = shallowRef<HTMLElement | null>(null);

const { element, elementProps, tag } = useRender(props, {
  defaultTagName: 'p',
  ref: (value) => {
    internalElement.value = value;
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="{}" />
  <component :is="tag" v-else v-bind="elementProps()"><slot /></component>
</template>
