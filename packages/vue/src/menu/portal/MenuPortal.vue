<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { PortalTargetProps } from '../../utils/popups/portal/PopupPortal.vue';

export interface MenuPortalState {}

export interface MenuPortalProps
  extends
    PortalTargetProps,
    VaseUIComponentProps<MenuPortalState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { usePortalFocus } from '../../utils/popups/portal/usePortalFocus';
import { computed, provide, useTemplateRef } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopupPortal from '../../utils/popups/portal/PopupPortal.vue';
import { useMenuRootContext } from '../root/MenuRootContext';
import MenuPortalChildren from './MenuPortalChildren.vue';
import { MenuPortalContext } from './MenuPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuPortalProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: MenuPortalState }): unknown;
  render(props: { props: HTMLProps; state: MenuPortalState; children: Component }): unknown;
}>();

const state: MenuPortalState = EMPTY_OBJECT;

const { store, parent } = useMenuRootContext();
const shouldRender = computed(() => store.select('mounted') || props.keepMounted);

provide(
  MenuPortalContext,
  computed(() => props.keepMounted),
);

// The owner element is at the place of this portal in the document. Its role thus follows the
// place of the root, which is fixed. The `parent` in the store can change, because a detached
// trigger gives its own.
const portalOwnerRole = parent.type === 'menu' || parent.type === 'menubar' ? 'group' : undefined;

// The template has one form for `#render` and one for the content. A `v-if` on a slot template
// makes the slots of the portal dynamic. Each part below the portal that has slot content then
// renders again with its parent.
const portalRef = useTemplateRef('portal');
const element = computed(() => portalRef.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <PopupPortal
    v-if="shouldRender && $slots.render"
    ref="portal"
    :guards="usePortalFocus"
    v-bind="{
      ...withoutPropsOf($attrs, PopupPortal),
      as,
      to,
      disabled,
      portalOwnerRole,
    }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" :children="MenuPortalChildren" />
    </template>
  </PopupPortal>
  <PopupPortal
    v-else-if="shouldRender"
    ref="portal"
    :guards="usePortalFocus"
    v-bind="{
      ...withoutPropsOf($attrs, PopupPortal),
      as,
      to,
      disabled,
      portalOwnerRole,
    }"
  >
    <MenuPortalChildren><slot :state="state" /></MenuPortalChildren>
  </PopupPortal>
</template>
