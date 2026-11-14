<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';

export interface NavigationMenuPositionerState {
  /**
   * Whether the navigation menu is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: boolean;
}

export interface NavigationMenuPositionerProps
  extends
    VaseUIComponentProps<NavigationMenuPositionerState>,
    UseAnchorPositioningSharedParameters,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  provide,
  shallowRef,
  watch,
} from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { NOOP } from '../../common/empty';
import { mergeCleanups } from '../../common/mergeCleanups';
import { ownerWindow } from '../../common/owner';
import { useTimeout } from '../../common/useTimeout';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useAnchorPositioning } from '../../internals/useAnchorPositioning';
import { useFloatingRootStore } from '../../utils/popups/floating-root/useFloatingRootStore';
import {
  disableFocusInside,
  enableFocusInside,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import { adaptiveOrigin } from '../../utils/popups/positioning/adaptiveOriginMiddleware';
import { useVaseUIFloating } from '../../utils/popups/positioning/useFloating';
import { usePositioner } from '../../utils/popups/positioning/usePositioner';
import { useNavigationMenuPortalContext } from '../portal/NavigationMenuPortalContext';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { createElementSetter } from '../utils/createElementSetter';
import { NavigationMenuPositionerContext } from './NavigationMenuPositionerContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuPositionerProps>(), {
  as: 'div',
  disableAnchorTracking: false,
  align: 'center',
  alignOffset: 0,
  side: 'bottom',
  sideOffset: 0,
  arrowPadding: 5,
  collisionBoundary: 'clipping-ancestors',
  collisionPadding: 5,
  sticky: false,
  positionMethod: 'absolute',
});

defineSlots<{
  default(props: { state: NavigationMenuPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuPositionerState>;
}>();

const { open, mounted, positionerElement, floatingRootStore, nested, transitionStatus } =
  useNavigationMenuRootContext();
const keepMounted = useNavigationMenuPortalContext();
const nodeId = useNavigationMenuTreeContext();

const initialInstantTimeout = useTimeout();
const resizeTimeout = useTimeout();

// A menu that is open at the first render has no positioner transition for one frame. A default
// value then does not animate in from the place of the portal before the first position.
const instant = shallowRef(open.value);
let needsInitialInstantReset = open.value;

// The active trigger gives its store to the root after the positioner rendered.
const fallbackRootStore = useFloatingRootStore({
  open: () => (keepMounted.value ? mounted.value : undefined),
});
const interactionStore = computed(() => floatingRootStore.value ?? fallbackRootStore);

const positioning = useAnchorPositioning({
  anchor: () => props.anchor,
  positionMethod: () => props.positionMethod,
  side: () => props.side,
  sideOffset: () => props.sideOffset,
  align: () => props.align,
  alignOffset: () => props.alignOffset,
  arrowPadding: () => props.arrowPadding,
  collisionBoundary: () => props.collisionBoundary,
  collisionPadding: () => props.collisionPadding,
  sticky: () => props.sticky,
  disableAnchorTracking: () => props.disableAnchorTracking,
  collisionAvoidance: () =>
    props.collisionAvoidance ?? (nested ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE),
  keepMounted,
  mounted,
  positionerElement,
  defaultAnchor: () => interactionStore.value.select('anchorElement'),
  shift: { rootBoundary: 'layoutViewport' },
  // With the side `top` or `left`, the size and the position of the menu change in the same
  // transition. The middleware keeps the menu at its anchor, with no wobble, while they change.
  adaptiveOrigin,
});

useVaseUIFloating({ rootStore: interactionStore, mounted, positioning, nodeId });

provide(NavigationMenuPositionerContext, positioning);

const state = computed<NavigationMenuPositionerState>(() => ({
  open: open.value,
  side: positioning.side.value,
  align: positioning.align.value,
  anchorHidden: positioning.anchorHidden.value,
  instant: instant.value,
}));

function handleResize() {
  instant.value = true;
  resizeTimeout.start(100, () => {
    instant.value = false;
  });
}

let removeResizeListener = NOOP;
let deactivated = false;

function listenToResize() {
  removeResizeListener();
  removeResizeListener = NOOP;

  if (!open.value || deactivated) {
    return;
  }

  if (needsInitialInstantReset) {
    initialInstantTimeout.start(0, () => {
      needsInitialInstantReset = false;

      if (!resizeTimeout.isStarted()) {
        instant.value = false;
      }
    });
  }

  removeResizeListener = addEventListener(
    ownerWindow(positionerElement.value),
    'resize',
    handleResize,
  );
}

onMounted(listenToResize);
watch([open, positionerElement], listenToResize, { flush: 'post' });
onScopeDispose(() => removeResizeListener());

onDeactivated(() => {
  deactivated = true;
  listenToResize();
});
// `onActivated` also runs at the first mount in a `KeepAlive`.
onActivated(() => {
  if (deactivated) {
    deactivated = false;
    listenToResize();
  }
});

// https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/TabbablePortal.tsx
watch(
  positionerElement,
  (positioner, _previous, onCleanup) => {
    if (!positioner) {
      return;
    }
    const element = positioner;

    // The elements in the portal are tabbable only after the focus entered the portal, from a
    // focus guard outside it or with the pointer.
    function handleFocus(event: FocusEvent) {
      if (isOutsideEvent(event)) {
        const manageFocus = event.type === 'focusin' ? enableFocusInside : disableFocusInside;
        manageFocus(element);
      }
    }

    // The listeners run in the capture phase, so they run before the focus handler of a focus
    // guard.
    onCleanup(
      mergeCleanups(
        addEventListener(element, 'focusin', handleFocus, true),
        addEventListener(element, 'focusout', handleFocus, true),
      ),
    );
  },
  { flush: 'post' },
);

const { element, elementProps } = usePositioner(props, {
  state,
  styles: positioning.positionerStyles,
  transitionStatus,
  ref: createElementSetter(positionerElement),
  hidden: () => !mounted.value,
  inert: () => !open.value,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
