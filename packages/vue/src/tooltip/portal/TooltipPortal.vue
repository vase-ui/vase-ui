<script lang="ts">
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { FloatingPortalContainer } from '../../utils/popups/portal/useFloatingPortalNode';

export interface TooltipPortalState {}

export interface TooltipPortalProps
  extends
    VaseUIComponentProps<TooltipPortalState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: MaybeRefOrGetter<FloatingPortalContainer> | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide, useTemplateRef } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import FloatingPortalLite from '../../utils/popups/portal/FloatingPortalLite.vue';
import { useTooltipRootContext, TooltipPortalContext } from '../root/TooltipRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipPortalProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: TooltipPortalState }): unknown;
  render(props: { props: HTMLProps; state: TooltipPortalState; children: Component }): unknown;
}>();

const state: TooltipPortalState = EMPTY_OBJECT;

const { mounted } = useTooltipRootContext();
const shouldRender = computed(() => mounted.value || props.keepMounted);

provide(
  TooltipPortalContext,
  computed(() => props.keepMounted),
);

// `keepMounted` is a prop of this part only, so the template gives each other prop by its name.
// The template has one form for `#render` and one for the content. A `v-if` on a slot template
// makes the slots of the portal dynamic. Each part below the portal that has slot content then
// renders again with its parent.
const portal = useTemplateRef('portal');
const element = computed(() => portal.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FloatingPortalLite
    v-if="shouldRender && $slots.render"
    ref="portal"
    v-bind="{
      ...withoutPropsOf($attrs, FloatingPortalLite),
      as,
      container,
    }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </FloatingPortalLite>
  <FloatingPortalLite
    v-else-if="shouldRender"
    ref="portal"
    v-bind="{
      ...withoutPropsOf($attrs, FloatingPortalLite),
      as,
      container,
    }"
  >
    <slot :state="state" />
  </FloatingPortalLite>
</template>
