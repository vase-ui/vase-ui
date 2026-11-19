import { computed, inject, shallowRef } from 'vue';
import { getComputedStyle } from '@floating-ui/utils/dom';
import { clamp } from '../../common/clamp';
import { ownerDocument } from '../../common/owner';
import { useResizeObserver } from '../../common/useResizeObserver';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useDomEffect } from '../../utils/popups/useDomEffect';
import type { ComputedRef, CSSProperties, InjectionKey, Ref } from 'vue';
import type {
  DrawerRootChangeEventDetails,
  DrawerRootSnapPointChangeEventDetails,
} from './DrawerRoot.vue';
import type { DialogStore } from '../../dialog/store/DialogStore';
import type { SwipeDirection } from '../../utils/useSwipeDismiss';

export type DrawerSwipeDirection = SwipeDirection;
export type DrawerSnapPoint = number | string;

export interface DrawerNestedSwipeProgressStore {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
}

export interface DrawerOpeningSwipe {
  movementX: number;
  movementY: number;
  progress: number;
  height: Ref<number>;
}

export interface DrawerRootContext {
  dialogContext: DialogStore<unknown>['context'];
  setOpen: (
    open: boolean,
    eventDetails: Omit<DrawerRootChangeEventDetails, 'preventUnmountOnClose'>,
  ) => void;
  swipeDirection: ComputedRef<DrawerSwipeDirection>;
  openingSwipe: Ref<DrawerOpeningSwipe | null>;
  viewportGesture: Ref<DrawerViewportContext | undefined>;
  /**
   * Whether to disable velocity-based snap skipping.
   */
  snapToSequentialPoints: ComputedRef<boolean>;
  /**
   * Snap points used to size/position the drawer.
   */
  snapPoints: ComputedRef<DrawerSnapPoint[] | undefined>;
  /**
   * The currently active snap point.
   */
  activeSnapPoint: ComputedRef<DrawerSnapPoint | null>;
  /**
   * Updates the currently active snap point.
   */
  setActiveSnapPoint: (
    snapPoint: DrawerSnapPoint | null,
    eventDetails?: DrawerRootSnapPointChangeEventDetails,
  ) => void;
  /**
   * The measured height of the frontmost open drawer within the current nested drawer stack.
   */
  frontmostHeight: Readonly<Ref<number>>;
  /**
   * The measured height of the drawer popup element.
   */
  popupHeight: Readonly<Ref<number>>;
  /**
   * Whether the current drawer has a nested drawer mounted in its stack (including while it is
   * transitioning out).
   */
  hasNestedDrawer: Readonly<Ref<boolean>>;
  /**
   * Called by the drawer popup to report its own measured height.
   */
  onPopupHeightChange: (height: number) => void;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedSwiping: Readonly<Ref<boolean>>;
  nestedSwipeProgressStore: DrawerNestedSwipeProgressStore;
  /**
   * Called by a nested drawer to report whether it is still present (open or transitioning out).
   */
  onNestedDrawerPresenceChange: (present: boolean) => void;
  /**
   * Called by a nested drawer to report the frontmost height of its own stack.
   */
  onNestedFrontmostHeightChange: (height: number) => void;
  /**
   * Called by a nested drawer to report whether it's being swiped.
   */
  onNestedSwipingChange: (swiping: boolean) => void;
  /**
   * Called by a nested drawer to report its swipe progress.
   */
  onNestedSwipeProgressChange: (progress: number) => void;
  /**
   * Provided to nested drawers so they can report their frontmost height to the parent drawer.
   */
  notifyParentFrontmostHeight?: ((height: number) => void) | undefined;
  /**
   * Provided to nested drawers so they can report swiping to the parent drawer.
   */
  notifyParentSwipingChange?: ((swiping: boolean) => void) | undefined;
  /**
   * Provided to nested drawers so they can report swipe progress to the parent drawer.
   */
  notifyParentSwipeProgressChange?: ((progress: number) => void) | undefined;
  /**
   * Provided to nested drawers so they can report whether they are still present (open or
   * transitioning out) to the parent drawer.
   */
  notifyParentHasNestedDrawer?: ((present: boolean) => void) | undefined;
}

export const DrawerRootContext: InjectionKey<DrawerRootContext> = Symbol();

export function useDrawerRootContext(optional?: false): DrawerRootContext;
export function useDrawerRootContext(optional: true): DrawerRootContext | undefined;
export function useDrawerRootContext(optional?: boolean) {
  const drawerRootContext = inject(DrawerRootContext, undefined);

  if (optional !== true && drawerRootContext === undefined) {
    throw new Error(
      'Vase UI: DrawerRootContext is missing. Without it a Drawer part has no drawer to read. Put the Drawer parts inside <Drawer.Root>.',
    );
  }

  return drawerRootContext;
}

export const DRAWER_CONTENT_ATTRIBUTE = 'data-drawer-content';

export const drawerContents = new WeakMap<Element, () => DialogStore<unknown>>();

export interface DrawerViewportContext {
  snapPoints: UseDrawerSnapPointsReturnValue;
  swiping: Readonly<Ref<boolean>>;
  getDragStyles: () => CSSProperties;
  getProgress: () => number;
  cancelHeldPopup: (popup: HTMLElement | null) => void;
  height: Readonly<Ref<number>>;
  release: Readonly<Ref<{ strength: number | null } | null>>;
}

export const DrawerViewportContext: InjectionKey<DrawerViewportContext> = Symbol();

export function useDrawerViewportContext(): DrawerViewportContext | undefined {
  return inject(DrawerViewportContext, undefined);
}

export interface DrawerVirtualKeyboardContext {
  onTouchstart: (event: TouchEvent) => void;
  // The viewport receives the move before the swipe stops propagation.
  onTouchmove: (event: TouchEvent) => void;
  onTouchend: (event: TouchEvent) => void;
  onTouchcancel: () => void;
}

export const DrawerVirtualKeyboardContext: InjectionKey<DrawerVirtualKeyboardContext> = Symbol();

export function useDrawerVirtualKeyboardContext(): DrawerVirtualKeyboardContext | undefined {
  return inject(DrawerVirtualKeyboardContext, undefined);
}

export interface ResolvedDrawerSnapPoint {
  value: DrawerSnapPoint;
  height: number;
  offset: number;
}

export function getSnapPointSwipeMovement(baseOffset: number, movementValue: number): number {
  const nextOffset = baseOffset + movementValue;
  if (nextOffset >= 0) {
    return movementValue;
  }

  return -Math.sqrt(-nextOffset) - baseOffset;
}

function resolveSnapPointValue(
  snapPoint: DrawerSnapPoint,
  viewportHeight: number,
  rootFontSize: number,
) {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return null;
  }

  if (typeof snapPoint === 'number') {
    if (!Number.isFinite(snapPoint)) {
      return null;
    }

    if (snapPoint <= 1) {
      return clamp(snapPoint, 0, 1) * viewportHeight;
    }

    return snapPoint;
  }

  const trimmed = snapPoint.trim();

  if (trimmed.endsWith('px')) {
    const value = Number.parseFloat(trimmed);
    return Number.isFinite(value) ? value : null;
  }

  if (trimmed.endsWith('rem')) {
    const value = Number.parseFloat(trimmed);
    return Number.isFinite(value) ? value * rootFontSize : null;
  }

  return null;
}

export function closestSnapPointIndex(values: number[], target: number): number {
  let closestIndex = -1;
  let closestDistance = Infinity;

  for (const [index, value] of values.entries()) {
    const distance = Math.abs(value - target);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

export interface UseDrawerSnapPointsReturnValue {
  snapPoints: DrawerRootContext['snapPoints'];
  activeSnapPoint: DrawerRootContext['activeSnapPoint'];
  setActiveSnapPoint: DrawerRootContext['setActiveSnapPoint'];
  popupHeight: DrawerRootContext['popupHeight'];
  viewportHeight: Readonly<Ref<number>>;
  resolvedSnapPoints: ComputedRef<ResolvedDrawerSnapPoint[]>;
  activeSnapPointOffset: ComputedRef<number | null>;
}

export function useDrawerSnapPoints(
  viewport?: DrawerViewportContext,
): UseDrawerSnapPointsReturnValue {
  const store = useDialogRootContext();
  const { snapPoints, activeSnapPoint, setActiveSnapPoint, popupHeight } = useDrawerRootContext();
  if (viewport?.snapPoints.activeSnapPoint === activeSnapPoint) {
    return viewport.snapPoints;
  }
  const viewportElement = computed(() => store.select('viewportElement'));

  const viewportHeight = shallowRef(0);
  const rootFontSize = shallowRef(16);

  function measureViewportHeight(element: HTMLElement | null) {
    const doc = ownerDocument(element);
    const html = doc.documentElement;

    viewportHeight.value = element ? element.offsetHeight : html.clientHeight;

    const fontSize = Number.parseFloat(getComputedStyle(html).fontSize);
    if (Number.isFinite(fontSize)) {
      rootFontSize.value = fontSize;
    }
  }

  useDomEffect([viewportElement], () => measureViewportHeight(viewportElement.value));
  useResizeObserver(viewportElement, () => measureViewportHeight(viewportElement.value));

  function snapHeight(value: DrawerSnapPoint) {
    const height = resolveSnapPointValue(value, viewportHeight.value, rootFontSize.value);
    return height === null
      ? null
      : clamp(height, 0, Math.min(popupHeight.value, viewportHeight.value));
  }

  const resolvedSnapPoints = computed(() => {
    const resolved: ResolvedDrawerSnapPoint[] = [];
    if (!snapPoints.value?.length || popupHeight.value <= 0 || viewportHeight.value <= 0) {
      return resolved;
    }

    // The last snap point wins when two heights differ by at most one pixel.
    for (const value of [...snapPoints.value].reverse()) {
      const height = snapHeight(value);
      if (height !== null && !resolved.some((point) => Math.abs(point.height - height) <= 1)) {
        resolved.push({ value, height, offset: popupHeight.value - height });
      }
    }
    return resolved.reverse();
  });

  const resolvedActiveSnapPoint = computed(() => {
    const active = activeSnapPoint.value;
    if (active === null) {
      return undefined;
    }

    const exactMatch = resolvedSnapPoints.value.find((point) => Object.is(point.value, active));
    if (exactMatch) {
      return exactMatch;
    }

    const height = snapHeight(active);
    if (height === null) {
      return undefined;
    }

    return resolvedSnapPoints.value[
      closestSnapPointIndex(
        resolvedSnapPoints.value.map((point) => point.height),
        height,
      )
    ];
  });

  return {
    snapPoints,
    activeSnapPoint,
    setActiveSnapPoint,
    popupHeight,
    viewportHeight,
    resolvedSnapPoints,
    activeSnapPointOffset: computed(() => resolvedActiveSnapPoint.value?.offset ?? null),
  };
}
