<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import { getEmptyRootStore } from '../../utils/popups/floating-root/getEmptyRootStore';
import type { PopupInteractionStore } from '../../utils/popups/types';

export interface NavigationMenuViewportState {}

export interface NavigationMenuViewportProps
  extends
    VaseUIComponentProps<NavigationMenuViewportState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the element. The owner element of the active trigger names it in `aria-owns`.
   */
  id?: string | undefined;
}

const EMPTY_ROOT_STORE = getEmptyRootStore();
</script>

<script setup lang="ts">
import { computed, watch } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { contains } from '../../common/shadowDom';
import type { HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import FocusGuard from '../../utils/popups/focus/FocusGuard.vue';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { createElementSetter } from '../utils/createElementSetter';
import NavigationMenuViewportChildren from './NavigationMenuViewportChildren.vue';
import { useNavigationMenuViewportGuards } from './useNavigationMenuViewportGuards';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuViewportProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: NavigationMenuViewportState }): unknown;
  render(props: {
    props: HTMLProps;
    state: NavigationMenuViewportState;
    children: Component;
  }): unknown;
}>();

const state: NavigationMenuViewportState = EMPTY_OBJECT;

const viewportId = useVaseUiId(() => props.id);

const {
  viewportElement,
  floatingRootStore,
  prevTriggerElementRef,
  viewportInert,
  setViewportInert,
} = useNavigationMenuRootContext();

// In a positioner, the two inside focus guards are siblings of the element. With no positioner,
// the element holds them.
const inPositioner = useNavigationMenuPositionerContext(true) !== undefined;
const guards = inPositioner ? useNavigationMenuViewportGuards() : undefined;

const domReference = computed(() => {
  const store: PopupInteractionStore = floatingRootStore.value ?? EMPTY_ROOT_STORE;
  return store.select('anchorElement');
});

watch(
  domReference,
  (reference) => {
    if (reference) {
      prevTriggerElementRef.value = reference;
    }
  },
  { immediate: true },
);

function handleFocusout(event: FocusEvent) {
  const relatedTarget = event.relatedTarget as Element | null;
  const currentTarget = event.currentTarget as Element;

  // The focus leaves the viewport for another element than the trigger. The viewport is then
  // inert, so that the focus cannot loop back into it.
  if (
    relatedTarget &&
    !contains(currentTarget, relatedTarget) &&
    relatedTarget !== domReference.value
  ) {
    setViewportInert(true);
  }
}

const { element, elementProps } = useRenderElement('div', props, {
  ref: createElementSetter(viewportElement),
  props: (attrs) => [
    {
      id: viewportId.value,
      onFocusout: handleFocusout,
      inert: !inPositioner && viewportInert.value ? true : undefined,
    },
    attrs,
  ],
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <template v-if="guards">
    <FocusGuard :ref="guards.setBeforeInsideGuard" @focusin="guards.handleBeforeInsideFocusin" />
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="NavigationMenuViewportChildren" />
    <component :is="as" v-else v-bind="elementProps()"><NavigationMenuViewportChildren><slot :state="state" /></NavigationMenuViewportChildren></component>
    <FocusGuard :ref="guards.setAfterInsideGuard" @focusin="guards.handleAfterInsideFocusin" />
  </template>
  <slot v-else-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="NavigationMenuViewportChildren" />
  <component :is="as" v-else v-bind="elementProps()"><NavigationMenuViewportChildren><slot :state="state" /></NavigationMenuViewportChildren></component>
</template>
