<script lang="ts">
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { FloatingPortalContainer } from '../../utils/popups/portal/useFloatingPortalNode';

export interface PopoverPortalState {}

export interface PopoverPortalProps
  extends
    VaseUIComponentProps<PopoverPortalState>,
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
import FloatingPortal from '../../utils/popups/portal/FloatingPortal.vue';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import PopoverPortalChildren from './PopoverPortalChildren.vue';
import { PopoverPortalContext } from './PopoverPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverPortalProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: PopoverPortalState }): unknown;
  render(props: { props: HTMLProps; state: PopoverPortalState; children: Component }): unknown;
}>();

const state: PopoverPortalState = EMPTY_OBJECT;

const store = usePopoverRootContext();
const shouldRender = computed(() => store.select('mounted') || props.keepMounted);

provide(
  PopoverPortalContext,
  computed(() => props.keepMounted),
);

// As in Base UI, this part renders `FloatingPortal` and makes no element of its own.
// `keepMounted` is a prop of this part only, so the template gives each other prop by its name.
// The template has one form for `#render` and one for the content. A `v-if` on a slot template
// makes the slots of the portal dynamic. Each part below the portal that has slot content then
// renders again with its parent.
const portal = useTemplateRef('portal');
const element = computed(() => portal.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FloatingPortal
    v-if="shouldRender && $slots.render"
    ref="portal"
    v-bind="{ ...$attrs, as, stateClass, stateStyle, container }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" :children="PopoverPortalChildren" />
    </template>
  </FloatingPortal>
  <FloatingPortal
    v-else-if="shouldRender"
    ref="portal"
    v-bind="{ ...$attrs, as, stateClass, stateStyle, container }"
  >
    <PopoverPortalChildren><slot :state="state" /></PopoverPortalChildren>
  </FloatingPortal>
</template>
