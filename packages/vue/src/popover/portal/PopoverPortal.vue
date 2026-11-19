<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { PortalTargetProps } from '../../utils/popups/portal/PopupPortal.vue';

export interface PopoverPortalState {}

export interface PopoverPortalProps
  extends
    PortalTargetProps,
    VaseUIComponentProps<PopoverPortalState>,
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
import { REASONS } from '../../internals/reasons';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopupPortal from '../../utils/popups/portal/PopupPortal.vue';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import PopupBackdropChildren, {
  PopupBackdropContext,
} from '../../utils/popups/portal/PopupBackdropChildren.vue';
import { PopoverPortalContext } from './PopoverPortalContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverPortalProps>(), { as: 'div', keepMounted: false });

defineSlots<{
  default(props: { state: PopoverPortalState }): unknown;
  render(props: { props: HTMLProps; state: PopoverPortalState; children: Component }): unknown;
}>();

const state: PopoverPortalState = EMPTY_OBJECT;

const { store, open, mounted, trigger } = usePopoverRootContext();
provide(PopupBackdropContext, () => {
  if (
    !mounted.value ||
    store.state.modal !== true ||
    !store.select('positionerElement') ||
    store.state.openChangeReason === REASONS.triggerHover
  )
    return null;
  return { inert: !open.value, cutout: trigger.value };
});

const shouldRender = computed(() => mounted.value || props.keepMounted);

provide(
  PopoverPortalContext,
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
      <slot name="render" v-bind="slotProps" :children="PopupBackdropChildren" />
    </template>
  </PopupPortal>
  <PopupPortal
    v-else-if="shouldRender"
    ref="portal"
    :guards="usePortalFocus"
    v-bind="{ ...withoutPropsOf($attrs, PopupPortal), as, to, disabled }"
  >
    <PopupBackdropChildren><slot :state="state" /></PopupBackdropChildren>
  </PopupPortal>
</template>
