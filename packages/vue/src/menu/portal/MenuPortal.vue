<script lang="ts">
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { FloatingPortalContainer } from '../../utils/popups/portal/useFloatingPortalNode';

export interface MenuPortalState {}

export interface MenuPortalProps
  extends
    VaseUIComponentProps<MenuPortalState>,
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
import { computed, provide, shallowRef } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import FloatingPortal from '../../utils/popups/portal/FloatingPortal.vue';
import { useMenuRootContext } from '../root/MenuRootContext';
import { MenuPortalContext } from './MenuPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuPortalProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: MenuPortalState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuPortalState>;
}>();

const { store, parent } = useMenuRootContext();
const shouldRender = computed(() => store.select('mounted') || props.keepMounted);

provide(
  MenuPortalContext,
  computed(() => props.keepMounted),
);

// The owner element is in the component tree at the place of this portal. Its role thus follows
// the place of the root, which is fixed. The `parent` in the store can change, because a detached
// trigger gives its own.
const portalOwnerRole = parent.type === 'menu' || parent.type === 'menubar' ? 'group' : undefined;

const portal = shallowRef<(ComponentPublicInstance & { element: HTMLElement | null }) | null>(null);
const element = computed(() => portal.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FloatingPortal
    v-if="shouldRender"
    ref="portal"
    v-bind="{ ...$attrs, as, stateClass, stateStyle, container, portalOwnerRole }"
  >
    <template v-if="$slots.render" #render="slotProps"
      ><slot name="render" v-bind="slotProps"
    /></template>
    <template #default="slotProps"><slot v-bind="slotProps" /></template>
  </FloatingPortal>
</template>
