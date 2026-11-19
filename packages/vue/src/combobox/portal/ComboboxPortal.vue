<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { PortalTargetProps } from '../../utils/popups/portal/PopupPortal.vue';

export interface ComboboxPortalState {}

export interface ComboboxPortalProps
  extends
    PortalTargetProps,
    VaseUIComponentProps<ComboboxPortalState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { usePortalFocus } from '../../utils/popups/portal/usePortalFocus';
import { computed, provide, useTemplateRef } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopupPortal from '../../utils/popups/portal/PopupPortal.vue';
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

// `keepMounted` is a prop of this part only, so the template gives each other prop by its name.
// The template has one form for `#render` and one for the content. A `v-if` on a slot template
// makes the slots of the portal dynamic. Each part below the portal that has slot content then
// renders again with its parent.
const portal = useTemplateRef('portal');
const element = computed(() => portal.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <PopupPortal
    v-if="shouldRender && $slots.render"
    ref="portal"
    :guards="usePortalFocus"
    v-bind="{ ...withoutPropsOf($attrs, PopupPortal), as, to, disabled }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" :children="ComboboxPortalChildren" />
    </template>
  </PopupPortal>
  <PopupPortal
    v-else-if="shouldRender"
    ref="portal"
    :guards="usePortalFocus"
    v-bind="{ ...withoutPropsOf($attrs, PopupPortal), as, to, disabled }"
  >
    <ComboboxPortalChildren><slot :state="state" /></ComboboxPortalChildren>
  </PopupPortal>
</template>
