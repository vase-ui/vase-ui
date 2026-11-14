<script lang="ts">
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { FloatingPortalContainer } from '../../utils/popups/portal/useFloatingPortalNode';

export interface ComboboxPortalState {}

export interface ComboboxPortalProps
  extends
    VaseUIComponentProps<ComboboxPortalState>,
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
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import ComboboxPortalChildren from './ComboboxPortalChildren.vue';
import { ComboboxPortalContext } from './ComboboxPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxPortalProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: ComboboxPortalState }): unknown;
  render(props: { props: HTMLProps; state: ComboboxPortalState; children: Component }): unknown;
}>();

const state: ComboboxPortalState = EMPTY_OBJECT;

const store = useComboboxRootContext();
const shouldRender = computed(
  () => store.select('mounted') || props.keepMounted || store.select('forceMounted'),
);

provide(
  ComboboxPortalContext,
  computed(() => props.keepMounted),
);

// As in Base UI, this part renders `FloatingPortal` and makes no element of its own.
// `keepMounted` is a prop of this part only, so the template gives each other prop by its name.
// The template has one form for `#render` and one for the content. A `v-if` on a slot template
// makes the slots dynamic, and each part below it that has slot content then renders again with
// its parent.
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
      <slot name="render" v-bind="slotProps" :children="ComboboxPortalChildren" />
    </template>
  </FloatingPortal>
  <FloatingPortal
    v-else-if="shouldRender"
    ref="portal"
    v-bind="{ ...$attrs, as, stateClass, stateStyle, container }"
  >
    <ComboboxPortalChildren><slot :state="state" /></ComboboxPortalChildren>
  </FloatingPortal>
</template>
