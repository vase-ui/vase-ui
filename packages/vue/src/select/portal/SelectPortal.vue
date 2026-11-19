<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { PortalTargetProps } from '../../utils/popups/portal/PopupPortal.vue';

export interface SelectPortalState {}

export interface SelectPortalProps
  extends
    PortalTargetProps,
    VaseUIComponentProps<SelectPortalState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { usePortalFocus } from '../../utils/popups/portal/usePortalFocus';
import { computed, provide, useTemplateRef } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopupPortal from '../../utils/popups/portal/PopupPortal.vue';
import { useSelectRootContext } from '../root/SelectRootContext';
import PopupBackdropChildren, {
  PopupBackdropContext,
} from '../../utils/popups/portal/PopupBackdropChildren.vue';

defineOptions({ inheritAttrs: false });

withDefaults(defineProps<SelectPortalProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectPortalState }): unknown;
  render(props: { props: HTMLProps; state: SelectPortalState; children: Component }): unknown;
}>();

const state: SelectPortalState = EMPTY_OBJECT;

const store = useSelectRootContext();
// `forceMounted` keeps the items of a closed select, so that it can match a value.
provide(PopupBackdropContext, () => {
  if (!store.select('mounted') || !store.select('modal') || !store.select('positionerElement'))
    return null;
  return { inert: !store.select('open'), cutout: store.select('triggerElement') };
});

const shouldRender = computed(() => store.select('mounted') || store.select('forceMounted'));

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
