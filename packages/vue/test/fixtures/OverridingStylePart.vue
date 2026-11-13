<script lang="ts">
import type { CSSProperties, HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface OverridingStylePartProps
  extends VaseUIComponentProps<{}>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /** The style that the part gives to `useRenderElement` as `overridingStyle`. */
  overridingStyle?: CSSProperties | undefined;
}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<OverridingStylePartProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: {} }): unknown;
  render: ComponentRenderFn<HTMLProps, {}>;
}>();

const { element, elementProps } = useRenderElement('div', props, {
  overridingStyle: () => props.overridingStyle,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="{}" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="{}" /></component>
</template>
