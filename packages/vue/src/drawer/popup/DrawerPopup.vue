<script lang="ts">
import type { CSSProperties, HTMLAttributes } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FocusOption } from '../../utils/popups/focus/FloatingFocusManager.vue';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import type { DrawerSwipeDirection } from '../root/DrawerRootContext';
import * as DrawerPopupCssVars from './DrawerPopupCssVars';
import * as DrawerPopupDataAttributes from './DrawerPopupDataAttributes';

export interface DrawerPopupProps
  extends
    VaseUIComponentProps<DrawerPopupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Determines the element to focus when the drawer is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - An element, a component or a ref: Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?: FocusOption | undefined;
  /**
   * Determines the element to focus when the drawer is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element, a component or a ref: Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusOption | undefined;
}

export interface DrawerPopupState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the active snap point is the full-height expanded state.
   */
  expanded: boolean;
  /**
   * Whether the drawer is nested within a parent drawer.
   */
  nested: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDrawerOpen: boolean;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedDrawerSwiping: boolean;
  /**
   * The swipe direction used to dismiss the drawer.
   */
  swipeDirection: DrawerSwipeDirection;
  /**
   * Whether the drawer is being swiped.
   */
  swiping: boolean;
}

// Module-level flag to ensure we only register the CSS properties once,
// regardless of how many Drawer components are mounted.
let drawerSwipeVarsRegistered = false;

/**
 * Removes inheritance of high-frequency drawer swipe CSS variables, which
 * reduces style recalculation cost in complex drawers with deep subtrees.
 * See https://motion.dev/blog/web-animation-performance-tier-list
 * under the "Improving CSS variable performance" section.
 */
function removeCSSVariableInheritance() {
  if (drawerSwipeVarsRegistered) {
    return;
  }

  // Intentionally keep inheritance disabled on WebKit as well. Safari doesn't support
  // opting descendants back in via `--var: inherit` for custom properties registered
  // with `inherits: false`, but Drawer does not rely on descendant access to these vars
  // (unlike ScrollArea), so we keep the performance optimization enabled.
  if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
    [
      DrawerPopupCssVars.swipeMovementX,
      DrawerPopupCssVars.swipeMovementY,
      DrawerPopupCssVars.snapPointOffset,
    ].forEach((name) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<length>',
          inherits: false,
          initialValue: '0px',
        });
      } catch {
        /* ignore already-registered */
      }
    });

    [
      {
        name: DrawerBackdropCssVars.swipeProgress,
        initialValue: '0',
      },
      {
        name: DrawerPopupCssVars.swipeStrength,
        initialValue: '1',
      },
    ].forEach(({ name, initialValue }) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<number>',
          inherits: false,
          initialValue,
        });
      } catch {
        /* ignore already-registered */
      }
    });
  }

  drawerSwipeVarsRegistered = true;
}

const stateAttributesMapping: StateAttributesMapping<DrawerPopupState> = {
  ...popupTransitionStateMapping,
  expanded(value) {
    return value ? { [DrawerPopupDataAttributes.expanded]: '' } : null;
  },
  nestedDrawerOpen(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerOpen]: '' } : null;
  },
  nestedDrawerSwiping(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerSwiping]: '' } : null;
  },
  swipeDirection(value) {
    return { [DrawerPopupDataAttributes.swipeDirection]: value };
  },
  swiping(value) {
    return value ? { [DrawerPopupDataAttributes.swiping]: '' } : null;
  },
};

type DragStyles = Record<string, string | undefined>;
</script>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onScopeDispose, shallowRef, watch } from 'vue';
import { EMPTY_OBJECT, NOOP } from '../../common/empty';
import { error } from '../../common/error';
import { useDialogPortalContext } from '../../dialog/portal/DialogPortalContext';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import FloatingFocusManager from '../../utils/popups/focus/FloatingFocusManager.vue';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupStoreUtils';
import { useDrawerRootContext } from '../root/DrawerRootContext';
import { getSnapPointSwipeMovement, useDrawerSnapPoints } from '../root/useDrawerSnapPoints';
import { useDrawerViewportContext } from '../viewport/DrawerViewportContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerPopupProps>(), {
  as: 'div',
  initialFocus: undefined,
  finalFocus: undefined,
});

defineSlots<{
  default(props: { state: DrawerPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, DrawerPopupState>;
}>();

const store = useDialogRootContext();
const popupRef = store.context.popupRef;

const {
  swipeDirection,
  frontmostHeight,
  hasNestedDrawer,
  nestedSwiping,
  nestedSwipeProgressStore,
  onPopupHeightChange,
  notifyParentFrontmostHeight,
  notifyParentHasNestedDrawer,
} = useDrawerRootContext();

const open = computed(() => store.select('open'));
const mounted = computed(() => store.select('mounted'));
const modal = computed(() => store.select('modal'));
const transitionStatus = computed(() => store.select('transitionStatus'));
const nestedOpenDrawerCount = computed(() => store.select('nestedOpenDrawerCount'));

const swipe = useDrawerViewportContext();
useDialogPortalContext();
const { snapPoints, activeSnapPoint, activeSnapPointOffset } = useDrawerSnapPoints();

const nestedDrawerOpen = computed(() => nestedOpenDrawerCount.value > 0);
const swiping = computed(() => swipe?.swiping.value ?? false);

const popupHeight = shallowRef(0);

if (process.env.NODE_ENV !== 'production') {
  onMounted(() => {
    if (swipe) {
      return;
    }

    error(
      '<Drawer.Popup> expected to be rendered within <Drawer.Viewport>.',
      'Omitting the viewport disables drawer swipe handling and touch scroll locking.',
      'Wrap <Drawer.Popup> in <Drawer.Viewport>.',
    );
  });
}

function measureHeight() {
  const popupElement = popupRef.value;
  if (!popupElement) {
    return;
  }

  const offsetHeight = popupElement.offsetHeight;

  // Only skip while the element is still actually stretched beyond its last measured height.
  if (
    popupHeight.value > 0 &&
    frontmostHeight.value > popupHeight.value &&
    offsetHeight > popupHeight.value
  ) {
    return;
  }

  const keepHeightWhileNested = popupHeight.value > 0 && hasNestedDrawer.value;
  if (keepHeightWhileNested) {
    onPopupHeightChange(popupHeight.value);
    return;
  }

  if (offsetHeight === popupHeight.value) {
    return;
  }

  popupHeight.value = offsetHeight;
  onPopupHeightChange(offsetHeight);
}

// `KeepAlive` takes the popup out of the document, and the popup then has no layout. The parts of
// the popup that read the layout, or that report to the drawer above, stop while it is
// deactivated.
const deactivated = shallowRef(false);

let clearFrontmostHeight = NOOP;
function reportFrontmostHeight() {
  clearFrontmostHeight();
  clearFrontmostHeight = NOOP;
  if (!notifyParentFrontmostHeight || !open.value || deactivated.value) {
    return;
  }

  notifyParentFrontmostHeight(frontmostHeight.value);
  clearFrontmostHeight = () => notifyParentFrontmostHeight(0);
}

let clearNestedPresence = NOOP;
function reportNestedPresence() {
  clearNestedPresence();
  clearNestedPresence = NOOP;
  if (!notifyParentHasNestedDrawer || deactivated.value) {
    return;
  }

  notifyParentHasNestedDrawer(open.value || transitionStatus.value === 'ending');
  clearNestedPresence = () => notifyParentHasNestedDrawer(false);
}

onMounted(() => {
  reportFrontmostHeight();
  reportNestedPresence();
});
watch([open, frontmostHeight, deactivated], reportFrontmostHeight);
watch([open, transitionStatus, deactivated], reportNestedPresence);
onScopeDispose(() => {
  clearFrontmostHeight();
  clearNestedPresence();
});

onDeactivated(() => {
  deactivated.value = true;
});
onActivated(() => {
  deactivated.value = false;
});

useOpenChangeComplete({
  open,
  ref: popupRef,
  onComplete() {
    if (open.value) {
      store.context.onOpenChangeComplete?.(true);
    }
  },
});

const resolvedInitialFocus = computed(() =>
  props.initialFocus === undefined ? popupRef : props.initialFocus,
);

const state = computed<DrawerPopupState>(() => ({
  open: open.value,
  nested: store.select('nested'),
  transitionStatus: transitionStatus.value,
  expanded: activeSnapPoint.value === 1,
  nestedDrawerOpen: nestedDrawerOpen.value,
  nestedDrawerSwiping: nestedSwiping.value,
  swipeDirection: swipeDirection.value,
  swiping: swiping.value,
}));

const shouldApplySnapPoints = computed(
  () =>
    snapPoints.value !== undefined &&
    snapPoints.value.length > 0 &&
    (swipeDirection.value === 'down' || swipeDirection.value === 'up'),
);

// The swipe writes the drag styles to the element in each frame, and the offset of the drag is not
// reactive. A render during a swipe thus reads the drag styles at the time of the render.
function getPopupDragStyles(): DragStyles {
  let dragStyles = (swipe ? swipe.getDragStyles() : EMPTY_OBJECT) as DragStyles;
  if (shouldApplySnapPoints.value && swipeDirection.value === 'down') {
    const baseOffset = activeSnapPointOffset.value ?? 0;
    const movementValue = Number.parseFloat(String(dragStyles[DrawerPopupCssVars.swipeMovementY]));

    if (swiping.value && Number.isFinite(movementValue)) {
      dragStyles = {
        ...dragStyles,
        transform: undefined,
        [DrawerPopupCssVars.swipeMovementY]: `${getSnapPointSwipeMovement(
          baseOffset,
          movementValue,
        )}px`,
      };
    } else {
      dragStyles = {
        ...dragStyles,
        transform: undefined,
      };
    }
  }

  return dragStyles;
}

function popupStyle(): CSSProperties {
  const { transition, transform, ...movementStyles } = getPopupDragStyles();

  let popupHeightCssVarValue: string | undefined;
  const shouldUseAutoHeight = !hasNestedDrawer.value && transitionStatus.value !== 'ending';
  if (popupHeight.value && !shouldUseAutoHeight) {
    popupHeightCssVarValue = `${popupHeight.value}px`;
  }

  let snapPointOffsetValue: number | null = null;
  if (shouldApplySnapPoints.value && activeSnapPointOffset.value !== null) {
    snapPointOffsetValue =
      swipeDirection.value === 'up' ? -activeSnapPointOffset.value : activeSnapPointOffset.value;
  }

  const swipeStrength = swipe?.swipeStrength.value ?? null;
  const nestedSwipeProgress = nestedSwipeProgressStore.getSnapshot();

  return {
    ...movementStyles,
    [DrawerBackdropCssVars.swipeProgress]:
      nestedSwipeProgress > 0 ? `${nestedSwipeProgress}` : '0',
    [DrawerPopupCssVars.nestedDrawers]: nestedOpenDrawerCount.value,
    [DrawerPopupCssVars.height]: popupHeightCssVarValue,
    [DrawerPopupCssVars.snapPointOffset]:
      typeof snapPointOffsetValue === 'number' ? `${snapPointOffsetValue}px` : '0px',
    [DrawerPopupCssVars.frontmostHeight]: frontmostHeight.value
      ? `${frontmostHeight.value}px`
      : undefined,
    [DrawerPopupCssVars.swipeStrength]:
      typeof swipeStrength === 'number' && Number.isFinite(swipeStrength) && swipeStrength > 0
        ? `${swipeStrength}`
        : '1',
  };
}

let ownPopup: HTMLElement | null = null;
function setPopup(popup: HTMLElement | null) {
  // A compiled template can mount a new popup before it unmounts the old one. The old one then
  // must not clear the element of the new one.
  if (popup !== null || popupRef.value === ownPopup) {
    popupRef.value = popup;
    store.set('popupElement', popup);
  }
  ownPopup = popup;
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: setPopup,
  stateAttributesMapping,
  props: (attrs) => [
    store.select('popupProps'),
    {
      id: store.select('defaultPopupId'),
      'aria-labelledby': store.select('titleElementId'),
      'aria-describedby': store.select('descriptionElementId'),
      role: store.select('role'),
      ...FOCUSABLE_POPUP_PROPS,
      hidden: mounted.value ? undefined : true,
      onKeydown(event: KeyboardEvent) {
        if (COMPOSITE_KEYS.has(event.key)) {
          event.stopPropagation();
        }
      },
      style: popupStyle(),
    },
    attrs,
  ],
  // A render during a swipe must keep the drag of the swipe, also over a `transform` or a
  // `transition` of the consumer.
  overridingStyle: () => {
    if (!swiping.value) {
      return undefined;
    }

    const { transition, transform } = getPopupDragStyles();
    return { transition, transform };
  },
});

watch(
  [element, mounted, nestedDrawerOpen, deactivated],
  ([popup, isMounted, , isDeactivated], _previous, onCleanup) => {
    if (isDeactivated) {
      return;
    }

    if (!isMounted) {
      popupHeight.value = 0;
      onPopupHeightChange(0);
      return;
    }

    if (!popup) {
      return;
    }

    removeCSSVariableInheritance();
    measureHeight();

    if (typeof ResizeObserver !== 'function') {
      return;
    }

    const resizeObserver = new ResizeObserver(measureHeight);

    resizeObserver.observe(popup);
    onCleanup(() => {
      resizeObserver.disconnect();
    });
  },
  { flush: 'post' },
);

watch(
  element,
  (popup, _previous, onCleanup) => {
    if (!popup) {
      return;
    }

    const syncNestedSwipeProgress = () => {
      const progress = nestedSwipeProgressStore.getSnapshot();
      popup.style.setProperty(DrawerBackdropCssVars.swipeProgress, progress > 0 ? `${progress}` : '0');
    };

    syncNestedSwipeProgress();
    const unsubscribe = nestedSwipeProgressStore.subscribe(syncNestedSwipeProgress);

    onCleanup(() => {
      unsubscribe();
      popup.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
    });
  },
  { flush: 'post' },
);

function getInsideElements() {
  return [store.context.internalBackdropRef.value];
}

defineExpose({ element });
</script>

<template>
  <FloatingFocusManager
    :store="store"
    :open-interaction-type="store.select('openMethod')"
    :disabled="!mounted"
    :close-on-focus-out="!store.select('disablePointerDismissal')"
    :initial-focus="resolvedInitialFocus"
    :return-focus="finalFocus"
    :modal="modal !== false"
    :outside-elements-inert="modal === true"
    :get-inside-elements="getInsideElements"
    restore-focus="popup"
  >
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </FloatingFocusManager>
</template>
