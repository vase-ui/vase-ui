<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface NavigationMenuListState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
}

export interface NavigationMenuListProps
  extends
    VaseUIComponentProps<NavigationMenuListState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { closestInEventPath } from '../../common/shadowDom';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useHoverPointerStyle, usePopupHover } from '../../utils/popups/interactions/usePopupHover';
import { useRenderElement } from '../../internals/useRenderElement';
import { getEmptyRootStore } from '../../utils/popups/floating-root/getEmptyRootStore';
import {
  dismissPopupBindings,
  useDismissLayer,
} from '../../utils/popups/interactions/useDismissLayer';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { navigationTriggers } from '../utils/constants';
import { NavigationMenuDismissContext } from './NavigationMenuDismissContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuListProps>(), { as: 'ul' });

defineSlots<{
  default(props: { state: NavigationMenuListState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuListState>;
}>();

const nodeId = useNavigationMenuTreeContext();

const {
  orientation,
  open,
  nested,
  floatingRootStore,
  positionerElement,
  viewportElement,
  value,
  closeDelay,
} = useNavigationMenuRootContext();

// The root points at the store of the active trigger. Until a trigger is active, the composables
// read a closed store.
const fallbackStore = getEmptyRootStore();
const store = () => floatingRootStore.value ?? fallbackStore;

usePopupHover(store).popup({
  enabled: () =>
    floatingRootStore.value != null &&
    (positionerElement.value != null || viewportElement.value != null || value.value == null),
  closeDelay,
  nodeId,
});

const dismiss = useDismissLayer(store, {
  enabled: () => positionerElement.value != null || value.value == null,
  outsidePressEvent: 'intentional',
  outsidePress(event) {
    return !closestInEventPath(event, (node) => navigationTriggers.has(node));
  },
});

const dismissProps = computed(() => (floatingRootStore.value ? dismiss : undefined));
provide(NavigationMenuDismissContext, dismissProps);

const state = computed<NavigationMenuListState>(() => ({ open: open.value }));

// When nested, the triggers and the links take part in the composite of the parent content, so the
// list makes no composite. The root decided `nested` one time.
const composite = nested ? undefined : useCompositeRoot({ loopFocus: false, orientation });

// `stopEventPropagation` won't stop the propagation if the end of the list is reached,
// but we want to block it in this case.
// When nested, skip this handler so arrow keys can reach the parent composite.
function onKeydown(event: KeyboardEvent) {
  const shouldStop =
    (orientation.value === 'horizontal' &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) ||
    (orientation.value === 'vertical' && (event.key === 'ArrowUp' || event.key === 'ArrowDown'));

  if (shouldStop) {
    event.stopPropagation();
  }
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('ul', props, {
  state,
  ref: composite?.registerRoot,
  props: (attrs) => [
    { style: hoverStyle.value },
    {
      onFocusin: composite?.onFocusin,
      onFocusout: composite?.onFocusout,
      onKeydown: composite?.onKeydown,
    },
    dismissProps.value && dismissPopupBindings(dismissProps.value),
    nested ? undefined : { onKeydown },
    attrs,
  ],
});
const hoverStyle = useHoverPointerStyle(element);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
