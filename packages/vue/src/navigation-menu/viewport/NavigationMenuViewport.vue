<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

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
</script>

<script setup lang="ts">
import { onMounted, shallowReactive } from 'vue';
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { contains } from '../../common/shadowDom';
import { warn } from '../../common/warn';
import type { HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useHoverPointerStyle } from '../../utils/popups/interactions/usePopupHover';
import { useElementRegistration } from '../../internals/useElementRegistration';
import { positionerHandlers } from '../../utils/popups/registeredParts';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { createElementSetter } from '../../utils/popups/createElementSetter';
import NavigationMenuViewportChildren, {
  useNavigationMenuViewportSiblingGuards,
} from './NavigationMenuViewportChildren.vue';

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
  nested,
  viewportElement,
  shownViewportElement,
  floatingRootStore,
  viewportInert,
  setViewportInert,
} = useNavigationMenuRootContext();

const hoverHandlers = shallowReactive(new Set<Record<string, unknown>>());
const inPositioner = useNavigationMenuPositionerContext(true) !== undefined;

if (process.env.NODE_ENV !== 'production' && !nested && !inPositioner) {
  onMounted(() => {
    warn(
      '<NavigationMenu.Viewport> of a top-level <NavigationMenu.Root> is not inside <NavigationMenu.Positioner>.',
      'A top-level root with no positioner does not close on Escape, on a click outside or on a second click on its trigger.',
      'Put the viewport inside <NavigationMenu.Portal>, <NavigationMenu.Positioner> and <NavigationMenu.Popup>. Only a nested root can have a viewport with no positioner.',
    );
  });
}

function handleFocusout(event: FocusEvent) {
  const relatedTarget = event.relatedTarget as Element | null;
  const currentTarget = event.currentTarget as Element;

  // The focus leaves the viewport for another element than the trigger. The viewport is then
  // inert, so that the focus cannot loop back into it.
  if (
    relatedTarget &&
    !contains(currentTarget, relatedTarget) &&
    relatedTarget !== floatingRootStore.value?.select('anchorElement')
  ) {
    setViewportInert(true);
  }
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  NavigationMenuViewportState,
  HTMLElement
>('div', props, {
  // The content stays in the held viewport. Only the owner element needs the id of a shown viewport.
  ref: [
    createElementSetter(viewportElement, { keepWhileHeld: true }),
    createElementSetter(shownViewportElement),
  ],
  props: (attrs) => [
    ...hoverHandlers,
    { style: hoverStyle.value },
    {
      id: viewportId.value,
      onFocusout: handleFocusout,
      inert: !inPositioner && viewportInert.value ? true : undefined,
    },
    attrs,
  ],
  children: true,
});
const hoverStyle = useHoverPointerStyle(element);

// In a positioner, the two inside focus guards are siblings of the element. Script keeps them
// there, so the part has one root node. With no positioner, the element holds them.
if (inPositioner) {
  useNavigationMenuViewportSiblingGuards(element);
} else {
  useElementRegistration(positionerHandlers, element, () => hoverHandlers);
}

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="NavigationMenuViewportChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <NavigationMenuViewportChildren><slot :state="state" /></NavigationMenuViewportChildren>
  </component>
</template>
