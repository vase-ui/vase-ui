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
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import FloatingPortal from '../../utils/popups/portal/FloatingPortal.vue';
import { useSelectRootContext } from '../root/SelectRootContext';

defineOptions({ inheritAttrs: false });

withDefaults(defineProps<SelectPortalProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectPortalState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectPortalState>;
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
      <slot name="render" v-bind="slotProps" />
    </template>
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </FloatingPortal>
</template>
