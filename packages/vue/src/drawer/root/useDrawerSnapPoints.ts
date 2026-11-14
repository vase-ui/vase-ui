import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  shallowRef,
  watch,
} from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { getComputedStyle } from '@floating-ui/utils/dom';
import { clamp } from '../../common/clamp';
import { ownerDocument } from '../../common/owner';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { NOOP } from '../../internals/noop';
import { useDrawerRootContext } from './DrawerRootContext';
import type { DrawerRootContext, DrawerSnapPoint } from './DrawerRootContext';

export interface ResolvedDrawerSnapPoint {
  value: DrawerSnapPoint;
  height: number;
  offset: number;
}

/**
 * Resolves the vertical swipe movement for a snap point, applying square-root damping once the drag
 * overshoots the fully-open edge (`nextOffset < 0`) so the popup resists travelling past it.
 */
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

/**
 * Returns the index of the value closest to `target`, or `-1` if `values` is empty.
 */
export function closestSnapPointIndex(values: number[], target: number): number {
  let closestIndex = -1;
  let closestDistance = Infinity;

  for (let index = 0; index < values.length; index += 1) {
    const distance = Math.abs(values[index] - target);
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

/**
 * Resolves the snap points of the drawer against the height of its viewport and of its popup. Call
 * it in `setup` of a part inside `Drawer.Root`.
 */
export function useDrawerSnapPoints(): UseDrawerSnapPointsReturnValue {
  const store = useDialogRootContext();
  const { snapPoints, activeSnapPoint, setActiveSnapPoint, popupHeight } = useDrawerRootContext();
  const viewportElement = computed(() => store.select('viewportElement'));

  const viewportHeight = shallowRef(0);
  const rootFontSize = shallowRef(16);

  function measureViewportHeight(element: HTMLElement | null) {
    const doc = ownerDocument(element);
    const html = doc.documentElement;

    viewportHeight.value = element ? element.offsetHeight : html.clientHeight;

    const fontSize = parseFloat(getComputedStyle(html).fontSize);
    if (Number.isFinite(fontSize)) {
      rootFontSize.value = fontSize;
    }
  }

  // `KeepAlive` takes the viewport of a deactivated part out of the document. The viewport then has
  // no layout, so the observer stops until the part is active again.
  let deactivated = false;
  let disconnect = NOOP;

  function observeViewport() {
    disconnect();
    disconnect = NOOP;
    if (deactivated) {
      return;
    }

    const element = viewportElement.value;
    measureViewportHeight(element);

    if (!element || typeof ResizeObserver !== 'function') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => measureViewportHeight(element));
    resizeObserver.observe(element);
    disconnect = () => resizeObserver.disconnect();
  }

  onMounted(observeViewport);
  watch(viewportElement, observeViewport, { flush: 'post' });

  onDeactivated(() => {
    deactivated = true;
    disconnect();
    disconnect = NOOP;
  });

  onActivated(() => {
    if (!deactivated) {
      return;
    }
    deactivated = false;
    observeViewport();
  });

  onScopeDispose(() => disconnect());

  const resolvedSnapPoints = computed<ResolvedDrawerSnapPoint[]>(() => {
    const points = snapPoints.value;
    if (!points || points.length === 0 || viewportHeight.value <= 0 || popupHeight.value <= 0) {
      return [];
    }

    const maxHeight = Math.min(popupHeight.value, viewportHeight.value);

    const resolved = points
      .map((value): ResolvedDrawerSnapPoint | null => {
        const resolvedHeight = resolveSnapPointValue(
          value,
          viewportHeight.value,
          rootFontSize.value,
        );
        if (resolvedHeight === null) {
          return null;
        }

        const clampedHeight = clamp(resolvedHeight, 0, maxHeight);
        return {
          value,
          height: clampedHeight,
          offset: Math.max(0, popupHeight.value - clampedHeight),
        };
      })
      .filter((point): point is ResolvedDrawerSnapPoint => Boolean(point));

    if (resolved.length <= 1) {
      return resolved;
    }

    const deduped: ResolvedDrawerSnapPoint[] = [];
    const seenHeights: number[] = [];

    for (let index = resolved.length - 1; index >= 0; index -= 1) {
      const point = resolved[index];
      const isDuplicate = seenHeights.some((height) => Math.abs(height - point.height) <= 1);
      if (isDuplicate) {
        continue;
      }

      seenHeights.push(point.height);
      deduped.push(point);
    }

    deduped.reverse();
    return deduped;
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

    const maxHeight = Math.min(popupHeight.value, viewportHeight.value);
    const resolvedHeight = resolveSnapPointValue(active, viewportHeight.value, rootFontSize.value);
    if (resolvedHeight === null) {
      return undefined;
    }

    const clampedHeight = clamp(resolvedHeight, 0, maxHeight);
    return resolvedSnapPoints.value[
      closestSnapPointIndex(
        resolvedSnapPoints.value.map((point) => point.height),
        clampedHeight,
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
