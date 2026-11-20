<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface StylePartProps
  extends VaseUIComponentProps<{}>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<StylePartProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: {} }): unknown;
  render: ComponentRenderFn<HTMLProps, {}>;
}>();

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="{}" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef"><slot :state="{}" /></component>
</template>
