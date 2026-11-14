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
import type { HTMLProps } from '../../internals/types';
import FloatingPortal from '../../utils/popups/portal/FloatingPortal.vue';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { ComboboxPortalContext } from './ComboboxPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxPortalProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: ComboboxPortalState }): unknown;
  render(props: { props: HTMLProps; state: ComboboxPortalState; children: Component }): unknown;
}>();

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
      <slot name="render" v-bind="slotProps" />
    </template>
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </FloatingPortal>
</template>
