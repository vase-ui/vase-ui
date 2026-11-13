import { computed, onActivated, onDeactivated, onMounted, shallowRef, toValue, watch } from 'vue';
import type {
  ComponentPublicInstance,
  ComputedRef,
  CSSProperties,
  MaybeRefOrGetter,
  Ref,
} from 'vue';
import { getAlignment, getSide, getSideAxis } from '@floating-ui/utils';
import type { Rect } from '@floating-ui/utils';
import {
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift as floatingShift,
  size,
  useFloating,
} from '@floating-ui/vue';
import type {
  Middleware,
  MiddlewareState,
  Padding,
  Placement,
  Side as PhysicalSide,
  VirtualElement,
} from '@floating-ui/vue';
import { areArraysEqual } from '../common/areArraysEqual';
import { ownerDocument, ownerWindow } from '../common/owner';
import { useDirection } from './direction-context/DirectionContext';
import { resolveElement } from './resolveElement';
import { arrow } from '../utils/popups/positioning/arrow';
import { hide } from '../utils/popups/positioning/hideMiddleware';
import { DEFAULT_SIDES } from '../utils/popups/positioning/adaptiveOriginConstants';
import * as CommonPositionerCssVars from '../utils/popups/positioning/CommonPositionerCssVars';

export { useFloatingRootStore } from '../utils/popups/floating-root/useFloatingRootStore';
export type { UseFloatingRootStoreOptions } from '../utils/popups/floating-root/useFloatingRootStore';
export type { FloatingRootStore } from '../utils/popups/floating-root/FloatingRootStore';
export type { PositioningInteractionStore } from '../utils/popups/types';

const AVAILABLE_WIDTH_VAR = CommonPositionerCssVars.availableWidth;
const AVAILABLE_HEIGHT_VAR = CommonPositionerCssVars.availableHeight;

function getLogicalSide(sideParam: Side, renderedSide: PhysicalSide, isRtl: boolean): Side {
  const isLogicalSideParam = sideParam === 'inline-start' || sideParam === 'inline-end';
  const logicalRight = isRtl ? 'inline-start' : 'inline-end';
  const logicalLeft = isRtl ? 'inline-end' : 'inline-start';
  return (
    {
      top: 'top',
      right: isLogicalSideParam ? logicalRight : 'right',
      bottom: 'bottom',
      left: isLogicalSideParam ? logicalLeft : 'left',
    } satisfies Record<PhysicalSide, Side>
  )[renderedSide];
}

function getOffsetData(state: MiddlewareState, sideParam: Side, isRtl: boolean) {
  const { rects, placement } = state;
  const data = {
    side: getLogicalSide(sideParam, getSide(placement), isRtl),
    align: getAlignment(placement) || 'center',
    anchor: { width: rects.reference.width, height: rects.reference.height },
    positioner: { width: rects.floating.width, height: rects.floating.height },
  } as const;
  return data;
}

export type Side = 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start';
export type Align = 'start' | 'center' | 'end';
type ElementTarget = Element | ComponentPublicInstance;
export type Boundary = 'clipping-ancestors' | ElementTarget | ElementTarget[] | Rect;
export type OffsetFunction = (data: {
  side: Side;
  align: Align;
  anchor: { width: number; height: number };
  positioner: { width: number; height: number };
}) => number;

interface SideFlipMode {
  /**
   * How to avoid collisions on the side axis.
   * - `'flip'`: If there is not enough space, place the popup on the opposite side.
   * - `'none'`: Keep the preferred side even if it overflows.
   */
  side?: 'flip' | 'none' | undefined;
  /**
   * How to avoid collisions on the align axis.
   * - `'flip'`: If there is not enough space, swap `'start'` and `'end'` alignment.
   * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred alignment even if it overflows.
   */
  align?: 'flip' | 'shift' | 'none' | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   * - `'start'`: Prefer the logical start side on the perpendicular axis.
   * - `'end'`: Prefer the logical end side on the perpendicular axis.
   * - `'none'`: Do not fallback to the perpendicular axis.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

interface SideShiftMode {
  /**
   * How to avoid collisions on the side axis.
   * - `'shift'`: Keep the preferred side and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred side even if it overflows.
   */
  side?: 'shift' | 'none' | undefined;
  /**
   * How to avoid collisions on the align axis.
   * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred alignment even if it overflows.
   */
  align?: 'shift' | 'none' | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   * - `'start'`: Prefer the logical start side on the perpendicular axis.
   * - `'end'`: Prefer the logical end side on the perpendicular axis.
   * - `'none'`: Do not fallback to the perpendicular axis.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

export type CollisionAvoidance = SideFlipMode | SideShiftMode;

type AnchorValue = Element | ComponentPublicInstance | VirtualElement | null | undefined;

function isVirtualElement(value: object): value is VirtualElement {
  return !('nodeType' in value) && 'getBoundingClientRect' in value;
}

function resolveAnchor(
  anchor: MaybeRefOrGetter<MaybeRefOrGetter<AnchorValue>>,
): Element | VirtualElement | null {
  // The first call reads the option. The second call reads the ref or the getter that the option
  // holds.
  const value = toValue(toValue(anchor));
  if (value == null) {
    return null;
  }
  // `resolveElement` shows a warning for an object that is not a component.
  return isVirtualElement(value) ? value : resolveElement(value);
}

type BoundaryValue = Boundary | null | undefined;
type ResolvedBoundary = 'clippingAncestors' | Element | Element[] | Rect;

const RECT_KEYS = ['x', 'y', 'width', 'height'] as const;

function isRect(value: object): value is Rect {
  // The ref of a component with no `expose` also gives its props, and a prop can have the name of a
  // side of a rectangle. Thus a component is never a rectangle.
  return (
    !('nodeType' in value) &&
    !('$props' in value) &&
    RECT_KEYS.every((key) => typeof (value as Record<string, unknown>)[key] === 'number')
  );
}

function resolveBoundary(
  boundary: MaybeRefOrGetter<MaybeRefOrGetter<BoundaryValue>>,
): ResolvedBoundary {
  const value = toValue(toValue(boundary));
  if (value == null || value === 'clipping-ancestors') {
    return 'clippingAncestors';
  }
  if (Array.isArray(value)) {
    return value.map(resolveElement).filter((element) => element !== null);
  }
  if (isRect(value)) {
    return value;
  }
  return resolveElement(value) ?? 'clippingAncestors';
}

function isSameBoundary(a: ResolvedBoundary, b: ResolvedBoundary) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return areArraysEqual(a, b);
  }
  if (typeof a === 'object' && typeof b === 'object' && isRect(a) && isRect(b)) {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  }
  return a === b;
}

type PaddingObject = { top: number; right: number; bottom: number; left: number };

/**
 * A `computed` that keeps its last value when the new value is equal to it. A consumer can give a
 * new object with the same content on each render, and such an object must start no position pass.
 */
function stableComputed<T>(getter: () => T, isEqual: (a: T, b: T) => boolean): ComputedRef<T> {
  return computed<T>((last) => {
    const value = getter();
    return last !== undefined && isEqual(last, value) ? last : value;
  });
}

/**
 * Provides standardized anchor positioning behavior for floating elements. Wraps Floating UI's
 * `useFloating` composable.
 */
export function useAnchorPositioning(
  params: UseAnchorPositioningParameters,
): UseAnchorPositioningReturnValue {
  const direction = useDirection();
  const isRtl = computed(() => direction.value === 'rtl');

  const mounted = computed(() => toValue(params.mounted));
  const sideParam = computed(() => toValue(params.side) ?? 'bottom');
  const alignParam = computed(() => toValue(params.align) ?? 'center');
  const positionMethod = computed(() => toValue(params.positionMethod) ?? 'absolute');
  const lazyFlip = computed(() => toValue(params.lazyFlip) ?? false);

  const collisionAvoidanceSide = computed(() => toValue(params.collisionAvoidance).side || 'flip');
  const collisionAvoidanceAlign = computed(
    () => toValue(params.collisionAvoidance).align || 'flip',
  );
  const collisionAvoidanceFallbackAxisSide = computed(
    () => toValue(params.collisionAvoidance).fallbackAxisSide || 'end',
  );
  const shiftCrossAxis = computed(() => toValue(params.shift)?.crossAxis ?? false);
  const shiftRootBoundary = computed(() => toValue(params.shift)?.rootBoundary);

  // An offset function gives no value before a position pass, so it counts as 0 here.
  const sideOffsetNumber = computed(() => {
    const value = toValue(params.sideOffset) ?? 0;
    return typeof value === 'function' ? 0 : value;
  });
  const alignOffsetNumber = computed(() => {
    const value = toValue(params.alignOffset) ?? 0;
    return typeof value === 'function' ? 0 : value;
  });

  const collisionPadding = stableComputed<PaddingObject>(
    () => {
      const value: Padding = toValue(params.collisionPadding) ?? 5;
      return typeof value === 'number'
        ? { top: value, right: value, bottom: value, left: value }
        : {
            top: value.top || 0,
            right: value.right || 0,
            bottom: value.bottom || 0,
            left: value.left || 0,
          };
    },
    (a, b) => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left,
  );

  // `true` from the mount to the unmount, except while a `KeepAlive` holds the component.
  const isActive = shallowRef(false);
  onMounted(() => {
    isActive.value = true;
  });
  onActivated(() => {
    isActive.value = true;
  });
  onDeactivated(() => {
    isActive.value = false;
  });

  const collisionBoundary = stableComputed<ResolvedBoundary>(
    // A getter of a consumer can read the DOM, so it does not run before the mount.
    () => (isActive.value ? resolveBoundary(params.collisionBoundary) : 'clippingAncestors'),
    isSameBoundary,
  );

  const mountPlacement = shallowRef<Placement | null>(null);
  watch(mounted, (isMounted) => {
    if (!isMounted) {
      mountPlacement.value = null;
    }
  });

  const lockAlign = computed(() => lazyFlip.value === 'placement');
  const side = computed<PhysicalSide>(() => {
    if (mountPlacement.value) {
      return getSide(mountPlacement.value);
    }
    return (
      {
        top: 'top',
        right: 'right',
        bottom: 'bottom',
        left: 'left',
        'inline-end': isRtl.value ? 'left' : 'right',
        'inline-start': isRtl.value ? 'right' : 'left',
      } satisfies Record<Side, PhysicalSide>
    )[sideParam.value];
  });
  const placementAlign = computed<Align>(() =>
    mountPlacement.value && lockAlign.value
      ? getAlignment(mountPlacement.value) || 'center'
      : alignParam.value,
  );
  const placement = computed<Placement>(() =>
    placementAlign.value === 'center'
      ? side.value
      : (`${side.value}-${placementAlign.value}` as Placement),
  );

  const shiftDisabled = computed(
    () => collisionAvoidanceAlign.value === 'none' && collisionAvoidanceSide.value !== 'shift',
  );
  const crossAxisShiftEnabled = computed(
    () =>
      !shiftDisabled.value &&
      ((toValue(params.sticky) ?? false) ||
        shiftCrossAxis.value ||
        collisionAvoidanceSide.value === 'shift'),
  );

  let arrowElement: Element | null = null;

  // The style of the positioner reads these two values, and `size()` writes them. Vue writes each
  // key of a rendered style again on each render, so constants there would replace the values that
  // `size()` wrote.
  // The start values make a consumer rule such as `max-height: min(x, var(--available-height))`
  // valid in the first position pass. Without them, the unresolved `var()` makes the whole
  // declaration invalid. The popup then has no cap, and `flip()` picks the side from the full
  // height of the content and not from the capped height.
  const availableWidthValue = shallowRef('100vw');
  const availableHeightValue = shallowRef('100vh');

  const readOffset = (value: OffsetSource | undefined, state: MiddlewareState) => {
    const offsetValue = toValue(value) ?? 0;
    return typeof offsetValue === 'function'
      ? offsetValue(getOffsetData(state, sideParam.value, isRtl.value))
      : offsetValue;
  };

  const middleware = computed<Middleware[]>(() => {
    const list: Middleware[] = [];
    const padding = collisionPadding.value;
    const sticky = toValue(params.sticky) ?? false;
    const arrowPadding = toValue(params.arrowPadding) ?? 5;

    const inlineMiddleware = toValue(params.inline);
    if (inlineMiddleware) {
      list.push(inlineMiddleware);
    }

    // The offset callback reads these values when a position pass calls it. These reads make a
    // new list when one of them changes.
    void sideOffsetNumber.value;
    void alignOffsetNumber.value;
    void isRtl.value;

    list.push(
      offset((state) => {
        const sideAxis = readOffset(params.sideOffset, state);
        const alignAxis = readOffset(params.alignOffset, state);
        return { mainAxis: sideAxis, crossAxis: alignAxis, alignmentAxis: alignAxis };
      }),
    );

    // A bias of 1 px favors the preferred side. On iOS, the software keyboard centers the input in
    // the viewport, and the popup can then flip to the top. The bias applies to `flip()` only, so
    // the position that `shift()` and `size()` compute stays at the requested `collisionPadding`.
    const bias = 1;
    const biasTop = sideParam.value === 'bottom' ? bias : 0;
    const biasBottom = sideParam.value === 'top' ? bias : 0;
    const biasLeft = sideParam.value === 'right' ? bias : 0;
    const biasRight = sideParam.value === 'left' ? bias : 0;

    const commonCollisionProps = { boundary: collisionBoundary.value, padding } as const;

    const flipOptions = {
      ...commonCollisionProps,
      // The popup must flip when its content grows after `--available-height` capped it.
      // The padding of `size()` is smaller than the padding of `flip()`, so `flip()` takes
      // precedence.
      padding: {
        top: padding.top + bias + biasTop,
        right: padding.right + bias + biasRight,
        bottom: padding.bottom + bias + biasBottom,
        left: padding.left + bias + biasLeft,
      },
      mainAxis: !shiftCrossAxis.value && collisionAvoidanceSide.value === 'flip',
      crossAxis: collisionAvoidanceAlign.value === 'flip' ? ('alignment' as const) : false,
      fallbackAxisSideDirection: collisionAvoidanceFallbackAxisSide.value,
    };
    const flipMiddleware =
      collisionAvoidanceSide.value === 'none'
        ? null
        : flip(
            // `size()` can raise the cap. After it runs in this pass, `flip()` accepts the new cap.
            ({ middlewareData }) =>
              middlewareData.size ? { ...flipOptions, padding } : flipOptions,
          );
    const shiftMiddleware = shiftDisabled.value
      ? null
      : floatingShift({
          ...commonCollisionProps,
          // The layout viewport as the root boundary stops the popup from moving during a pinch
          // zoom.
          rootBoundary: shiftRootBoundary.value,
          mainAxis: collisionAvoidanceAlign.value !== 'none',
          crossAxis: crossAxisShiftEnabled.value,
          limiter:
            sticky || shiftCrossAxis.value
              ? undefined
              : limitShift((limitData) => {
                  if (!arrowElement) {
                    return {};
                  }
                  const { width, height } = arrowElement.getBoundingClientRect();
                  const sideAxis = getSideAxis(getSide(limitData.placement));
                  const arrowSize = sideAxis === 'y' ? width : height;
                  const offsetAmount =
                    sideAxis === 'y' ? padding.left + padding.right : padding.top + padding.bottom;
                  return { offset: arrowSize / 2 + offsetAmount / 2 };
                }),
        });

    // https://floating-ui.com/docs/flip#combining-with-shift
    // The order depends on the alignment that the placement requests, not on the `align` option.
    // A locked alignment can differ from `align`, and the order must match the placement.
    const ordered =
      collisionAvoidanceSide.value === 'shift' ||
      collisionAvoidanceAlign.value === 'shift' ||
      placementAlign.value === 'center'
        ? [shiftMiddleware, flipMiddleware]
        : [flipMiddleware, shiftMiddleware];
    for (const item of ordered) {
      if (item) {
        list.push(item);
      }
    }

    list.push(
      size({
        ...commonCollisionProps,
        apply({ elements: { floating }, availableWidth, availableHeight, rects }) {
          if (!mounted.value) {
            return;
          }

          const nextAvailableWidth = `${availableWidth}px`;
          const nextAvailableHeight = `${availableHeight}px`;
          // A positioner part can render a style of its own and not `positionerStyles`. An example
          // is `Select.Positioner`, which aligns an item with the trigger. Its element then has
          // the two values only from this write.
          floating.style.setProperty(AVAILABLE_WIDTH_VAR, nextAvailableWidth);
          floating.style.setProperty(AVAILABLE_HEIGHT_VAR, nextAvailableHeight);
          availableWidthValue.value = nextAvailableWidth;
          availableHeightValue.value = nextAvailableHeight;

          // Snap the anchor size to device pixels. The visual width of the popup then matches the
          // anchor.
          const dpr = ownerWindow(floating).devicePixelRatio || 1;
          const { x: anchorX, y: anchorY, width: rectWidth, height: rectHeight } = rects.reference;
          const anchorWidth =
            (Math.round((anchorX + rectWidth) * dpr) - Math.round(anchorX * dpr)) / dpr;
          const anchorHeight =
            (Math.round((anchorY + rectHeight) * dpr) - Math.round(anchorY * dpr)) / dpr;

          floating.style.setProperty(CommonPositionerCssVars.anchorWidth, `${anchorWidth}px`);
          floating.style.setProperty(CommonPositionerCssVars.anchorHeight, `${anchorHeight}px`);
        },
      }),
      arrow((state) => ({
        // The `transform-origin` calculation needs an element. When the arrow is not set, use a
        // fake element.
        element: arrowElement || ownerDocument(state.elements.floating).createElement('div'),
        // The fake arrow gets no padding. Padding would move an aligned popup on a narrow anchor.
        padding: arrowElement ? arrowPadding : 0,
      })),
      {
        name: 'transformOrigin',
        fn(state) {
          const {
            elements: { floating },
            middlewareData: data,
            placement: currentPlacement,
            platform,
            rects,
            y: currentY,
          } = state;

          const currentSide = getSide(currentPlacement);
          const currentAlign = getAlignment(currentPlacement);
          const isVertical = getSideAxis(currentSide) === 'y';
          const arrowEl = arrowElement;

          const sideOffsetValue = readOffset(params.sideOffset, state);

          // An aligned popup with no arrow grows from its aligned edge. This stops when a shift of
          // more than 1 px breaks the alignment with the anchor. Each other popup grows from the
          // arrow, real or fake.
          let crossOrigin: string;
          if (
            !arrowEl &&
            currentAlign &&
            Math.abs(isVertical ? data.shift?.x || 0 : data.shift?.y || 0) <= 1
          ) {
            // Use the direction of the platform, not `isRtl`. It must match the direction that
            // Floating UI used to place the popup.
            crossOrigin =
              (currentAlign === 'start') === (isVertical && platform.isRTL?.(floating) === true)
                ? '100%'
                : '0%';
          } else {
            const arrowOffset = isVertical ? data.arrow?.x || 0 : data.arrow?.y || 0;
            const arrowSize = isVertical ? arrowEl?.clientWidth || 0 : arrowEl?.clientHeight || 0;
            crossOrigin = `${arrowOffset + arrowSize / 2}px`;
          }

          // On the side axis, the origin is the edge that faces the anchor. When the popup
          // overlaps the anchor, it is the center of the anchor.
          let sideOrigin =
            currentSide === 'top' || currentSide === 'left'
              ? `calc(100% + ${sideOffsetValue}px)`
              : `${-sideOffsetValue}px`;
          if (
            crossAxisShiftEnabled.value &&
            isVertical &&
            Math.abs(data.shift?.y || 0) > sideOffsetValue
          ) {
            sideOrigin = `${rects.reference.y + rects.reference.height / 2 - currentY}px`;
          }

          floating.style.setProperty(
            CommonPositionerCssVars.transformOrigin,
            isVertical ? `${crossOrigin} ${sideOrigin}` : `${sideOrigin} ${crossOrigin}`,
          );

          return {};
        },
      },
      hide,
    );

    const adaptiveOrigin = toValue(params.adaptiveOrigin);
    if (adaptiveOrigin) {
      list.push(adaptiveOrigin);
    }

    return list;
  });

  // The anchor that the popup has while it is mounted. The write comes after the DOM update.
  const registeredAnchor = shallowRef<Element | VirtualElement | null>(null);
  // The reference is empty in the write that closes the popup, or that makes `KeepAlive` hold the
  // component. `autoUpdate` then stops at once.
  const reference = computed(() =>
    mounted.value && isActive.value ? registeredAnchor.value : null,
  );
  const floating = computed(() => toValue(params.positionerElement) ?? null);

  const registerAnchor = () => {
    registeredAnchor.value =
      mounted.value && isActive.value
        ? (resolveAnchor(params.anchor) ?? toValue(params.defaultAnchor) ?? null)
        : null;
  };
  watch(
    [
      mounted,
      isActive,
      // A getter of a consumer can read the DOM, so it runs only while the popup is mounted.
      () => (mounted.value && isActive.value ? toValue(toValue(params.anchor)) : null),
      () => toValue(params.defaultAnchor),
    ],
    registerAnchor,
    { flush: 'post' },
  );

  const getAutoUpdateOptions = () => {
    const tracking = !(toValue(params.disableAnchorTracking) ?? false);
    return {
      ancestorScroll: tracking,
      elementResize: tracking && typeof ResizeObserver !== 'undefined',
      layoutShift: tracking && typeof IntersectionObserver !== 'undefined',
    };
  };

  let restartAutoUpdate: (() => void) | undefined;

  // `useFloating` computes a position in a sync watcher for each option that changes. One write
  // for all three options gives one position pass for one flush.
  const floatingOptions = shallowRef({
    placement: placement.value,
    strategy: positionMethod.value,
    middleware: middleware.value,
  });
  watch(
    [placement, positionMethod, middleware],
    ([nextPlacement, nextStrategy, nextMiddleware]) => {
      floatingOptions.value = {
        placement: nextPlacement,
        strategy: nextStrategy,
        middleware: nextMiddleware,
      };
    },
  );

  const open = () => (toValue(params.keepMounted) ? mounted.value : undefined);

  const {
    x,
    y,
    middlewareData,
    update,
    placement: renderedPlacement,
    isPositioned: floatingIsPositioned,
    floatingStyles,
  } = useFloating(reference, floating, {
    open,
    placement: () => floatingOptions.value.placement,
    middleware: () => floatingOptions.value.middleware,
    strategy: () => floatingOptions.value.strategy,
    whileElementsMounted(referenceElement, floatingElement, updatePosition) {
      const start = () =>
        autoUpdate(referenceElement, floatingElement, updatePosition, getAutoUpdateOptions());
      let stop = start();
      restartAutoUpdate = () => {
        stop();
        stop = start();
      };
      return () => {
        restartAutoUpdate = undefined;
        stop();
      };
    },
  });

  watch(
    () => toValue(params.disableAnchorTracking) ?? false,
    () => {
      restartAutoUpdate?.();
    },
  );

  // `useFloating` reads `open` when a position pass starts, and Base UI reads it when the pass
  // ends. A pass that ends after the popup closed then gives `true` for a closed popup. This ref is
  // `true` only when a pass ends while the popup is open. The end of a pass is a source, because
  // `useFloating` keeps `true` from an earlier open. The flush is `sync`: a reader outside a
  // render, such as the microtask of `arrowRef`, needs the value in the write that ends the pass.
  const isPositioned = shallowRef(false);
  watch(
    [middlewareData, floatingIsPositioned],
    () => {
      isPositioned.value = floatingIsPositioned.value && open() !== false;
    },
    { flush: 'sync' },
  );

  // An arrow that mounts or unmounts after the popup has a position does not resize the
  // positioner, so the position must be computed again.
  const arrowRef = (element: Element | null) => {
    // Vue calls a function ref again on each patch.
    if (element === arrowElement) {
      return;
    }
    arrowElement = element;
    // Vue calls this function in a render, so the render must not depend on `isPositioned`. The
    // read is in the microtask. The microtask runs after the flush, so an anchor that changed in
    // the same flush is registered first.
    queueMicrotask(() => {
      if (isPositioned.value) {
        update();
      }
    });
  };

  const positionerStyles = computed<CSSProperties>(() => {
    // Use `fixed` until the popup has a position. The popup then stays in the viewport, and
    // `autoFocus` causes no scroll jump.
    const position = isPositioned.value ? positionMethod.value : 'fixed';
    let base: CSSProperties & Record<string, unknown>;
    if (!isPositioned.value) {
      // Until the popup has a position for this open, ignore old coordinates. They come from an
      // earlier open, or from a pass that measured the hidden popup as 0 by 0. A full-size popup
      // at such coordinates can overflow the layout viewport. Mobile Chrome then zooms the page
      // out and reflows everything that the popup is anchored to.
      base = { position, top: 0, left: 0 };
    } else if (toValue(params.adaptiveOrigin)) {
      const { sideX, sideY } = middlewareData.value.adaptiveOrigin || DEFAULT_SIDES;
      base = { position, [sideX]: `${x.value}px`, [sideY]: `${y.value}px` };
    } else {
      base = { ...floatingStyles.value, position };
    }

    base[AVAILABLE_WIDTH_VAR] = availableWidthValue.value;
    base[AVAILABLE_HEIGHT_VAR] = availableHeightValue.value;

    if (!isPositioned.value) {
      base.opacity = 0;
    }
    return base;
  });

  const renderedSide = computed(() => getSide(renderedPlacement.value));
  const logicalRenderedSide = computed(() =>
    getLogicalSide(sideParam.value, renderedSide.value, isRtl.value),
  );
  const renderedAlign = computed<Align>(() => getAlignment(renderedPlacement.value) || 'center');
  const anchorHidden = computed(() => Boolean(middlewareData.value.hide?.referenceHidden));

  // Lock the flipped side while filtering resizes the popup. When the consumer opts in, lock the
  // alignment too.
  watch([lazyFlip, mounted, isPositioned, renderedPlacement, side, placementAlign], () => {
    if (
      lazyFlip.value &&
      mounted.value &&
      isPositioned.value &&
      (renderedSide.value !== side.value ||
        (lockAlign.value && renderedAlign.value !== placementAlign.value))
    ) {
      mountPlacement.value = renderedPlacement.value;
    }
  });

  const arrowStyles = computed<CSSProperties>(() => {
    const arrowData = middlewareData.value.arrow;
    return {
      position: 'absolute',
      top: arrowData?.y == null ? undefined : `${arrowData.y}px`,
      left: arrowData?.x == null ? undefined : `${arrowData.x}px`,
    };
  });

  const arrowUncentered = computed(() => middlewareData.value.arrow?.centerOffset !== 0);

  return {
    positionerStyles,
    arrowStyles,
    arrowRef,
    arrowUncentered,
    side: logicalRenderedSide,
    align: renderedAlign,
    physicalSide: renderedSide,
    placement: renderedPlacement,
    anchorHidden,
    reference,
    isPositioned,
    update,
  };
}

export interface UseAnchorPositioningSharedParameters {
  /**
   * An element to position the popup against.
   * By default, the popup will be positioned against the trigger.
   * It can be an element, a component, a virtual element, or a ref or a getter for one of them.
   */
  anchor?: MaybeRefOrGetter<AnchorValue> | undefined;
  /**
   * Determines which CSS `position` property to use.
   * @default 'absolute'
   */
  positionMethod?: 'absolute' | 'fixed' | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'bottom'
   */
  side?: Side | undefined;
  /**
   * Distance between the anchor and the popup in pixels.
   * Also accepts a function that returns the distance to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```vue
   * <Positioner
   *   :side-offset="({ side, align, anchor, positioner }) =>
   *     side === 'top' || side === 'bottom' ? anchor.height : anchor.width
   *   "
   * />
   * ```
   *
   * @default 0
   */
  sideOffset?: number | OffsetFunction | undefined;
  /**
   * How to align the popup relative to the specified side.
   * @default 'center'
   */
  align?: Align | undefined;
  /**
   * Additional offset along the alignment axis in pixels.
   * Also accepts a function that returns the offset to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```vue
   * <Positioner
   *   :align-offset="({ side, align, anchor, positioner }) =>
   *     side === 'top' || side === 'bottom' ? anchor.width : anchor.height
   *   "
   * />
   * ```
   *
   * @default 0
   */
  alignOffset?: number | OffsetFunction | undefined;
  /**
   * An element or a rectangle that delimits the area that the popup is confined to.
   * It can also be a component, or a ref or a getter for one of these values.
   * @default 'clipping-ancestors'
   */
  collisionBoundary?: MaybeRefOrGetter<BoundaryValue> | undefined;
  /**
   * Additional space to maintain from the edge of the collision boundary.
   * @default 5
   */
  collisionPadding?: Padding | undefined;
  /**
   * Whether to maintain the popup in the viewport after
   * the anchor element was scrolled out of view.
   * @default false
   */
  sticky?: boolean | undefined;
  /**
   * Minimum distance to maintain between the arrow and the edges of the popup.
   *
   * Use it to prevent the arrow element from hanging out of the rounded corners of a popup.
   * @default 5
   */
  arrowPadding?: number | undefined;
  /**
   * Whether to disable the popup from tracking any layout shift of its positioning anchor.
   * @default false
   */
  disableAnchorTracking?: boolean | undefined;
  /**
   * Determines how to handle collisions when positioning the popup.
   *
   * `side` controls overflow on the preferred placement axis (`top`/`bottom` or `left`/`right`):
   * - `'flip'`: keep the requested side when it fits; otherwise try the opposite side
   *   (`top` and `bottom`, or `left` and `right`).
   * - `'shift'`: never change side; keep the requested side and move the popup within
   *   the clipping boundary so it stays visible.
   * - `'none'`: do not correct side-axis overflow.
   *
   * `align` controls overflow on the alignment axis (`start`/`center`/`end`):
   * - `'flip'`: keep side, but swap `start` and `end` when the requested alignment overflows.
   * - `'shift'`: keep side and requested alignment, then nudge the popup along the
   *   alignment axis to fit.
   * - `'none'`: do not correct alignment-axis overflow.
   *
   * `fallbackAxisSide` controls fallback behavior on the perpendicular axis when the
   * preferred axis cannot fit:
   * - `'start'`: allow perpendicular fallback and try the logical start side first
   *   (`top` before `bottom`, or `left` before `right` in LTR).
   * - `'end'`: allow perpendicular fallback and try the logical end side first
   *   (`bottom` before `top`, or `right` before `left` in LTR).
   * - `'none'`: do not fallback to the perpendicular axis.
   *
   * When `side` is `'shift'`, explicitly setting `align` only supports `'shift'` or `'none'`.
   * If `align` is omitted, it defaults to `'flip'`.
   *
   * @example
   * ```vue
   * <Positioner
   *   :collision-avoidance="{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }"
   * />
   * ```
   *
   */
  collisionAvoidance?: CollisionAvoidance | undefined;
}

type Sources<T> = { [K in keyof T]: MaybeRefOrGetter<T[K]> };

// A plain offset function is not a valid value here, because `toValue` calls a function.
type OffsetSource =
  | number
  | Readonly<Ref<number | OffsetFunction | undefined>>
  | (() => number | OffsetFunction | undefined);

export interface UseAnchorPositioningParameters extends Sources<
  Omit<UseAnchorPositioningSharedParameters, 'sideOffset' | 'alignOffset' | 'collisionAvoidance'>
> {
  sideOffset?: OffsetSource | undefined;
  alignOffset?: OffsetSource | undefined;
  keepMounted?: MaybeRefOrGetter<boolean | undefined>;
  mounted: MaybeRefOrGetter<boolean>;
  /**
   * The element of the positioner.
   */
  positionerElement: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /**
   * The anchor of the root: its active trigger, or a reference that the root sets. The popup uses
   * it when `anchor` gives no element.
   */
  defaultAnchor?: MaybeRefOrGetter<Element | VirtualElement | null | undefined>;
  adaptiveOrigin?: MaybeRefOrGetter<Middleware | undefined>;
  collisionAvoidance: MaybeRefOrGetter<CollisionAvoidance>;
  shift?: MaybeRefOrGetter<
    | {
        crossAxis?: boolean | undefined;
        rootBoundary?: 'layoutViewport' | undefined;
      }
    | undefined
  >;
  /**
   * Locks a flipped placement, so that the popup does not flip back while filtering resizes it.
   * `true` locks the side only. `'placement'` also locks the alignment.
   */
  lazyFlip?: MaybeRefOrGetter<boolean | 'placement' | undefined>;
  /**
   * A middleware that can replace the measured rectangle of the anchor before the offset and
   * collision middleware run. Preview Card uses it to position the popup against one inline line
   * box.
   */
  inline?: MaybeRefOrGetter<Middleware | undefined>;
}

export interface UseAnchorPositioningReturnValue {
  positionerStyles: ComputedRef<CSSProperties>;
  arrowStyles: ComputedRef<CSSProperties>;
  arrowRef: (element: Element | null) => void;
  arrowUncentered: ComputedRef<boolean>;
  /**
   * The side of the anchor that the popup is on. It has a logical name when the `side` option has
   * one.
   */
  side: ComputedRef<Side>;
  align: ComputedRef<Align>;
  physicalSide: ComputedRef<PhysicalSide>;
  /**
   * The placement that the popup has. It starts as the requested placement, and it changes when
   * the popup flips.
   */
  placement: Readonly<Ref<Placement>>;
  anchorHidden: ComputedRef<boolean>;
  /**
   * The element or the virtual element that the popup is positioned against. It is `null` while
   * the popup is not mounted and while `KeepAlive` holds the component.
   */
  reference: ComputedRef<Element | VirtualElement | null>;
  isPositioned: Readonly<Ref<boolean>>;
  update: () => void;
}
