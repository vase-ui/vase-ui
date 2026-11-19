<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { PortalTargetProps } from '../../utils/popups/portal/PopupPortal.vue';

export interface NavigationMenuPortalState {}

export interface NavigationMenuPortalProps
  extends
    PortalTargetProps,
    VaseUIComponentProps<NavigationMenuPortalState>,
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
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { NavigationMenuPortalContext } from './NavigationMenuPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuPortalProps>(), {
  as: 'div',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: NavigationMenuPortalState }): unknown;
  render(props: {
    props: HTMLProps;
    state: NavigationMenuPortalState;
    children: Component;
  }): unknown;
}>();

const state: NavigationMenuPortalState = EMPTY_OBJECT;

const { mounted } = useNavigationMenuRootContext();
const shouldRender = computed(() => mounted.value || props.keepMounted);

provide(
  NavigationMenuPortalContext,
  computed(() => props.keepMounted),
);

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
    v-bind="{ ...withoutPropsOf($attrs, PopupPortal), as, to, disabled }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </PopupPortal>
  <PopupPortal
    v-else-if="shouldRender"
    ref="portal"
    :guards="usePortalFocus"
    v-bind="{ ...withoutPropsOf($attrs, PopupPortal), as, to, disabled }"
  >
    <slot :state="state" />
  </PopupPortal>
</template>
