<script lang="ts">
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../../internals/types';
import type { FloatingPortalContainer } from './useFloatingPortalNode';

export interface FloatingPortalLiteState {}

export interface FloatingPortalLiteProps
  extends
    VaseUIComponentProps<FloatingPortalLiteState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * A parent element to render the portal element into.
   */
  container?: MaybeRefOrGetter<FloatingPortalContainer> | undefined;
}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../../common/empty';
import type { HTMLProps } from '../../../internals/types';
import FloatingPortalChildren from './FloatingPortalChildren.vue';
import { useFloatingPortalNode } from './useFloatingPortalNode';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FloatingPortalLiteProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: FloatingPortalLiteState }): unknown;
  render(props: { props: HTMLProps; state: FloatingPortalLiteState; children: Component }): unknown;
}>();

const state: FloatingPortalLiteState = EMPTY_OBJECT;

const { element, elementProps, containerElement, deactivated } = useFloatingPortalNode({
  container: () => props.container,
  componentProps: props,
  children: true,
});

defineExpose({ element });
</script>

<template>
  <Teleport v-if="containerElement" :to="containerElement" :disabled="deactivated">
    <slot
      v-if="$slots.render"
      name="render"
      :props="elementProps()"
      :state="state"
      :children="FloatingPortalChildren"
    />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </Teleport>
</template>
