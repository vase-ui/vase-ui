<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface ChildrenPartState {
  /** The value that the part shows in its own node. */
  value: number | undefined;
}

export interface ChildrenPartProps
  extends
    VaseUIComponentProps<ChildrenPartState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /** The value that the part shows in its own node. */
  value?: number | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import type { Component } from 'vue';
import type { HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';
import ChildrenPartChildren from './ChildrenPartChildren.vue';
import { CHILDREN_PART_STATE } from './ChildrenPartContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ChildrenPartProps>(), {
  as: 'div',
  value: undefined,
});

defineSlots<{
  default(props: { state: ChildrenPartState }): unknown;
  render(props: { props: HTMLProps; state: ChildrenPartState; children: Component }): unknown;
}>();

const state = computed<ChildrenPartState>(() => ({ value: props.value }));

provide(CHILDREN_PART_STATE, state);

const { element, elementProps } = useRenderElement('div', props, { state, children: true });

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="ChildrenPartChildren" />
  <component :is="as" v-else v-bind="elementProps()"><ChildrenPartChildren><slot :state="state" /></ChildrenPartChildren></component>
</template>
