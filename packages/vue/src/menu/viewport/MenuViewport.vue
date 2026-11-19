<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface MenuViewportState {
  /**
   * The activation direction of the transitioned content.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
  /**
   * Present if animations should be instant.
   */
  instant: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
}

export interface MenuViewportProps
  extends
    VaseUIComponentProps<MenuViewportState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import PopupViewportChildren from '../../utils/popups/viewport/PopupViewportChildren.vue';
import { usePopupViewport } from '../../utils/popups/viewport/usePopupViewport';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useMenuRootContext } from '../root/MenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuViewportProps>(), { as: 'div' });

defineSlots<{
  /**
   * The content to render inside the transition container.
   */
  default(props: { state: MenuViewportState }): unknown;
  render(props: { props: HTMLProps; state: MenuViewportState; children: Component }): unknown;
}>();

const { store } = useMenuRootContext();
const positioner = useMenuPositionerContext();

const { element, elementProps, setRef, usesRenderSlot, state } = usePopupViewport(
  props,
  store,
  positioner.side,
);

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="PopupViewportChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <PopupViewportChildren><slot :state="state" /></PopupViewportChildren>
  </component>
</template>
