<script setup vapor lang="ts">
import { useRenderElement } from './useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    as?: string | undefined;
    enabled: boolean;
    count?: number | undefined;
    withChildren?: boolean | undefined;
  }>(),
  { as: 'div', count: 0, withChildren: false },
);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  children: props.withChildren,
});

defineExpose({ element });

// The `<span>` reads `count`. A change of `count` thus updates the part, and the `v-if` of the
// slot does not run again.
</script>

<template>
  <slot v-if="enabled && usesRenderSlot()" name="render" :props="elementProps()" :state="{}" />
  <component :is="as" v-else-if="enabled" v-bind="elementProps()" :ref="setRef">
    <slot />
  </component>
  <span :data-count="count" />
</template>
