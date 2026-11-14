<script lang="ts">
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { FloatingPortalContainer } from '../../utils/popups/portal/useFloatingPortalNode';

export interface NavigationMenuPortalState {}

export interface NavigationMenuPortalProps
  extends
    VaseUIComponentProps<NavigationMenuPortalState>,
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
import FloatingPortal from '../../utils/popups/portal/FloatingPortal.vue';
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

const { mounted } = useNavigationMenuRootContext();

provide(
  NavigationMenuPortalContext,
  computed(() => props.keepMounted),
);

// As in Base UI, this part renders `FloatingPortal` and makes no element of its own.
const portalRef = useTemplateRef('portal');
const element = computed(() => portalRef.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FloatingPortal
    v-if="mounted || keepMounted"
    ref="portal"
    v-bind="{ ...$attrs, as, stateClass, stateStyle, container }"
  >
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </FloatingPortal>
</template>
