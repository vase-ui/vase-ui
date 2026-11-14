<script lang="ts">
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { FloatingPortalContainer } from '../../utils/popups/portal/useFloatingPortalNode';

export interface SelectPortalState {}

export interface SelectPortalProps
  extends
    VaseUIComponentProps<SelectPortalState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * A parent element to render the portal element into.
   */
  container?: MaybeRefOrGetter<FloatingPortalContainer> | undefined;
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import FloatingPortal from '../../utils/popups/portal/FloatingPortal.vue';
import { useSelectRootContext } from '../root/SelectRootContext';
import SelectPortalChildren from './SelectPortalChildren.vue';

defineOptions({ inheritAttrs: false });

withDefaults(defineProps<SelectPortalProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectPortalState }): unknown;
  render(props: { props: HTMLProps; state: SelectPortalState; children: Component }): unknown;
}>();

const state: SelectPortalState = EMPTY_OBJECT;

const store = useSelectRootContext();
// The root mounts the items before the first open, so that a closed select can match a value.
const shouldRender = computed(() => store.select('mounted') || store.select('forceMounted'));

// As in Base UI, this part renders `FloatingPortal` and makes no element of its own.
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
      <slot name="render" v-bind="slotProps" :children="SelectPortalChildren" />
    </template>
  </FloatingPortal>
  <FloatingPortal
    v-else-if="shouldRender"
    ref="portal"
    v-bind="{ ...$attrs, as, stateClass, stateStyle, container }"
  >
    <SelectPortalChildren><slot :state="state" /></SelectPortalChildren>
  </FloatingPortal>
</template>
