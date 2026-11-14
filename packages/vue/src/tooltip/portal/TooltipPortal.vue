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
import type { HTMLProps } from '../../internals/types';
import FloatingPortalLite from '../../utils/popups/portal/FloatingPortalLite.vue';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { TooltipPortalContext } from './TooltipPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipPortalProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: TooltipPortalState }): unknown;
  render(props: { props: HTMLProps; state: TooltipPortalState; children: Component }): unknown;
}>();

const store = useTooltipRootContext();
const shouldRender = computed(() => store.select('mounted') || props.keepMounted);

provide(
  TooltipPortalContext,
  computed(() => props.keepMounted),
);

// As in Base UI, this part renders `FloatingPortalLite` and makes no element of its own.
// `keepMounted` is a prop of this part only, so the template gives each other prop by its name.
const portal = useTemplateRef('portal');
const element = computed(() => portal.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FloatingPortalLite
    v-if="shouldRender"
    ref="portal"
    v-bind="{ ...$attrs, as, stateClass, stateStyle, container }"
  >
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </FloatingPortalLite>
</template>
