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

const store = useSelectRootContext();
// The root mounts the items before the first open, so that a closed select can match a value.
const shouldRender = computed(() => store.select('mounted') || store.select('forceMounted'));

// As in Base UI, this part renders `FloatingPortal` and makes no element of its own.
const portal = useTemplateRef('portal');
const element = computed(() => portal.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <FloatingPortal
    v-if="shouldRender"
    ref="portal"
    v-bind="{ ...$attrs, as, stateClass, stateStyle, container }"
  >
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" :children="SelectPortalChildren" />
    </template>
    <template #default="slotProps">
      <SelectPortalChildren><slot v-bind="slotProps" /></SelectPortalChildren>
    </template>
  </FloatingPortal>
</template>
