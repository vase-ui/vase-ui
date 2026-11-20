import {
  clamp,
  evaluate,
  getAlignment,
  getAlignmentAxis,
  getAxisLength,
  getPaddingObject,
  getSide,
  getSideAxis,
  type Rect,
} from '@floating-ui/utils';
import {
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift,
  size,
  // eslint-disable-next-line no-restricted-imports -- The popup layer gives `useFloating` the middleware of Base UI, as `useAnchorPositioning` does for the old parts.
  useFloating,
  type Middleware,
  type MiddlewareState,
  type Padding,
  type Placement,
  type Side as PhysicalSide,
  type VirtualElement,
} from '@floating-ui/vue';

import { computed, nextTick, shallowRef, watch, type CSSProperties, type Ref } from 'vue';
import { ownerWindow } from '../common/owner';
import type { PopupRoot } from './root';

export type Side = 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start';
export type Align = 'start' | 'center' | 'end';
export type { VirtualElement };

export type OffsetFunction = (data: {
  side: Side;
  align: Align;
  anchor: { width: number; height: number };
  positioner: { width: number; height: number };
}) => number;

/** An element, or a template ref of a part, which has `element`. */
type ElementSource = Element | { readonly element: Element | null } | null | undefined;

export type Anchor = ElementSource | VirtualElement;

export type Boundary = 'clipping-ancestors' | Element | Element[] | Rect;

export interface CollisionAvoidance {
  /**
   * The side axis: `'flip'` places the popup on the other side when it has no room, `'shift'`
   * keeps the side and moves the popup into the boundary, `'none'` does nothing.
   */
  side?: 'flip' | 'shift' | 'none';
  /**
   * The align axis: `'flip'` swaps `start` and `end` when the popup has no room, `'shift'` keeps
   * the alignment and moves the popup into the boundary, `'none'` does nothing.
   */
  align?: 'flip' | 'shift' | 'none';
  /**
   * With no room on both sides of the preferred axis, the popup can go to a side of the other
   * axis: the logical `'start'` or `'end'` first, or `'none'`.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none';
}

export interface PlacementProps {
  /**
   * The side of the anchor for the popup. It can change to avoid a collision.
   * @default 'bottom'
   */
  side?: Side;
  /**
   * The alignment of the popup on the side.
   * @default 'center'
   */
  align?: Align;
  /**
   * The distance from the anchor in pixels, or a function that gives it.
   * @default 0
   */
  sideOffset?: number | OffsetFunction;
  /**
   * The offset on the align axis in pixels, or a function that gives it.
   * @default 0
   */
  alignOffset?: number | OffsetFunction;
  /**
   * The element to place the popup against: an element, a virtual element, a template ref of a
   * part, or a function that gives one. With no value, the active trigger.
   */
  anchor?: Anchor | (() => Anchor);
  /** How the popup avoids the edge of the boundary. */
  collisionAvoidance?: CollisionAvoidance;
  /**
   * The area that holds the popup: an element, elements, or a rectangle.
   * @default 'clipping-ancestors'
   */
  collisionBoundary?: Boundary;
  /**
   * The space between the popup and the edge of the boundary, in pixels.
   * @default 5
   */
  collisionPadding?: Padding;
  /**
   * The popup stays in the view after its anchor scrolls out of it.
   * @default false
   */
  sticky?: boolean;
  /**
   * The smallest space between the arrow and an edge of the popup, in pixels.
   * @default 5
   */
  arrowPadding?: number;
  /**
   * The CSS `position` of the positioner.
   * @default 'absolute'
   */
  positionMethod?: 'absolute' | 'fixed';
  /**
   * The popup does not follow a move of its anchor.
   * @default false
   */
  disableAnchorTracking?: boolean;
}

function isVirtualElement(value: object): value is VirtualElement {
  return !('nodeType' in value) && 'getBoundingClientRect' in value;
}

function elementOf(value: ElementSource): Element | null {
  if (!value) return null;
  return 'nodeType' in value ? value : value.element;
}

function resolveAnchor(anchor: PlacementProps['anchor']): Element | VirtualElement | null {
  const value = typeof anchor === 'function' ? anchor() : anchor;
  if (!value) return null;
  return isVirtualElement(value) ? value : elementOf(value);
}

/** The logical side for a placed physical side, when the prop has a logical side. */
function logicalSide(prop: Side, placed: PhysicalSide, rtl: boolean): Side {
  if (prop !== 'inline-start' && prop !== 'inline-end') return placed;
  if (placed === 'left') return rtl ? 'inline-end' : 'inline-start';
  if (placed === 'right') return rtl ? 'inline-start' : 'inline-end';
  return placed;
}

function physicalSide(side: Side, rtl: boolean): PhysicalSide {
  if (side === 'inline-start') return rtl ? 'right' : 'left';
  if (side === 'inline-end') return rtl ? 'left' : 'right';
  return side;
}

/**
 * Places the positioner at its anchor with Floating UI: the side, the alignment, the collision,
 * the available size, the arrow and the transform origin. It follows the anchor while the popup
 * is open.
 */
export function usePlacement(
  root: PopupRoot,
  props: Required<Omit<PlacementProps, 'anchor' | 'collisionAvoidance'>> &
    Pick<PlacementProps, 'anchor' | 'collisionAvoidance'>,
  options: {
    positioner: Readonly<Ref<HTMLElement | null>>;
    /** Places the positioner with insets from the edge that faces the anchor. */
    insets: () => boolean;
  },
) {
  const rtl = shallowRef(false);
  const arrowElement = shallowRef<HTMLElement | null>(null);
  // An unset variable makes a rule such as `max-height: min(20rem, var(--available-height))`
  // invalid in the first placement. The popup then has no cap, and `flip()` reads its full height
  // (test/measurements/popup.test.ts).
  const available = shallowRef({ width: '100vw', height: '100vh' });
  const anchorSize = shallowRef<{ width: string; height: string }>();

  const reference = shallowRef<Element | VirtualElement | null>(null);
  watch(
    [
      () => root.open,
      () => root.activeTrigger,
      () => resolveAnchor(props.anchor),
      options.positioner,
    ],
    ([open, trigger, anchor]) => {
      const element = options.positioner.value;
      if (element) rtl.value = ownerWindow(element).getComputedStyle(element).direction === 'rtl';
      // The popup stays at its place while it leaves.
      reference.value = open ? (anchor ?? trigger) : null;
    },
    { flush: 'post', immediate: true },
  );

  const padding = computed(() => {
    const value = props.collisionPadding;
    return typeof value === 'number'
      ? { top: value, right: value, bottom: value, left: value }
      : { top: 0, right: 0, bottom: 0, left: 0, ...value };
  });
  const boundary = computed<'clippingAncestors' | Element | Element[] | Rect>(() =>
    props.collisionBoundary === 'clipping-ancestors' ? 'clippingAncestors' : props.collisionBoundary,
  );
  const sideMode = computed(() => props.collisionAvoidance?.side ?? 'flip');
  const alignMode = computed(() => props.collisionAvoidance?.align ?? 'flip');
  const placement = computed<Placement>(() => {
    const side = physicalSide(props.side, rtl.value);
    return props.align === 'center' ? side : `${side}-${props.align}`;
  });

  const readOffset = (value: number | OffsetFunction, state: MiddlewareState) =>
    typeof value === 'function'
      ? value({
          side: logicalSide(props.side, getSide(state.placement), rtl.value),
          align: getAlignment(state.placement) ?? 'center',
          anchor: { width: state.rects.reference.width, height: state.rects.reference.height },
          positioner: { width: state.rects.floating.width, height: state.rects.floating.height },
        })
      : value;

  const middleware = computed<Middleware[]>(() => {
    const common = { boundary: boundary.value, padding: padding.value };
    const shiftsSide = sideMode.value === 'shift';
    const flipping =
      sideMode.value === 'none'
        ? null
        : flip({
            ...common,
            mainAxis: sideMode.value === 'flip',
            crossAxis: alignMode.value === 'flip' ? 'alignment' : false,
            fallbackAxisSideDirection: props.collisionAvoidance?.fallbackAxisSide ?? 'end',
          });
    const shifting =
      alignMode.value === 'none' && !shiftsSide
        ? null
        : shift({
            ...common,
            mainAxis: alignMode.value !== 'none',
            crossAxis: props.sticky || shiftsSide,
            limiter: props.sticky
              ? undefined
              : limitShift((state) => {
                  const arrow = arrowElement.value?.getBoundingClientRect();
                  if (!arrow) return {};
                  const vertical = getSideAxis(getSide(state.placement)) === 'y';
                  const room = vertical
                    ? padding.value.left + padding.value.right
                    : padding.value.top + padding.value.bottom;
                  return { offset: (vertical ? arrow.width : arrow.height) / 2 + room / 2 };
                }),
          });
    // https://floating-ui.com/docs/flip#combining-with-shift
    const collision =
      shiftsSide || alignMode.value === 'shift' || props.align === 'center'
        ? [shifting, flipping]
        : [flipping, shifting];
    return [
      offset((state) => {
        const along = readOffset(props.alignOffset, state);
        return { mainAxis: readOffset(props.sideOffset, state), crossAxis: along, alignmentAxis: along };
      }),
      ...collision.filter((item): item is Middleware => !!item),
      size({
        ...common,
        apply({ elements, availableWidth, availableHeight, rects }) {
          available.value = { width: `${availableWidth}px`, height: `${availableHeight}px` };
          // The width of the anchor in device pixels, so that a popup with this width covers the
          // same pixels (test/measurements/popup.test.ts).
          const ratio = ownerWindow(elements.floating).devicePixelRatio || 1;
          const { x, y, width, height } = rects.reference;
          const snap = (start: number, length: number) =>
            (Math.round((start + length) * ratio) - Math.round(start * ratio)) / ratio;
          anchorSize.value = { width: `${snap(x, width)}px`, height: `${snap(y, height)}px` };
          // Floating UI measures the popup again after Vue writes the variables.
          return nextTick();
        },
      }),
      arrow(() => ({
        element: arrowElement.value,
        padding: props.arrowPadding,
      })),
      transformOrigin(() => ({
        arrow: arrowElement.value,
        sideOffset: (state: MiddlewareState) => readOffset(props.sideOffset, state),
        shiftsCrossAxis: props.sticky || shiftsSide,
      })),
      hide,
      ...(options.insets() ? [insets] : []),
    ];
  });

  const floating = useFloating(reference, options.positioner, {
    placement,
    strategy: () => props.positionMethod,
    middleware,
    // The popup stays at its place while its anchor is out of the document: after the trigger left
    // the DOM, and before an app in a detached element joins the document.
    whileElementsMounted: (anchor, element, update) =>
      autoUpdate(anchor, element, () => ('isConnected' in anchor && !anchor.isConnected ? undefined : update()), {
        ancestorScroll: !props.disableAnchorTracking,
        elementResize: !props.disableAnchorTracking,
        layoutShift: !props.disableAnchorTracking,
      }),
  });

  // The first placement of each open. An earlier open placed the popup at another anchor.
  const placed = shallowRef(false);
  watch(
    () => root.open,
    (open) => {
      if (open) placed.value = false;
    },
    { flush: 'sync' },
  );
  watch(
    floating.middlewareData,
    () => {
      if (root.open && reference.value) placed.value = true;
    },
    { flush: 'sync' },
  );
  watch(arrowElement, () => floating.update());

  const placedSide = computed(() => getSide(floating.placement.value));
  const side = computed(() => logicalSide(props.side, placedSide.value, rtl.value));
  const align = computed<Align>(() => getAlignment(floating.placement.value) ?? 'center');
  const anchorHidden = computed(() => !!floating.middlewareData.value.hide?.referenceHidden);

  const style = computed<CSSProperties>(() => {
    const data = floating.middlewareData.value.insets as Insets | undefined;
    const place: CSSProperties = data
      ? {
          position: floating.strategy.value,
          [data.x]: `${floating.x.value}px`,
          [data.y]: `${floating.y.value}px`,
        }
      : floating.floatingStyles.value;
    return {
      ...place,
      '--available-width': available.value.width,
      '--available-height': available.value.height,
      '--anchor-width': anchorSize.value?.width,
      '--anchor-height': anchorSize.value?.height,
      '--transform-origin': placed.value
        ? (floating.middlewareData.value.transformOrigin?.value as string | undefined)
        : undefined,
      // The server HTML of a portal in place and the first render have no place yet.
      visibility: placed.value ? undefined : 'hidden',
    };
  });

  const arrowStyle = computed<CSSProperties>(() => {
    const data = floating.middlewareData.value.arrow;
    return {
      position: 'absolute',
      top: data?.y == null ? undefined : `${data.y}px`,
      left: data?.x == null ? undefined : `${data.x}px`,
    };
  });
  const arrowUncentered = computed(() => {
    const data = floating.middlewareData.value.arrow;
    return !!data && data.centerOffset !== 0;
  });

  return {
    style,
    side,
    align,
    anchorHidden,
    placed,
    arrow: {
      style: arrowStyle,
      uncentered: arrowUncentered,
      setElement(element: HTMLElement | null) {
        arrowElement.value = element;
      },
    },
  };
}

interface ArrowOptions {
  element: HTMLElement | null;
  padding: number;
}

/**
 * The `arrow()` of Floating UI with the floating element as the offset parent of the arrow. With no
 * arrow, it gives the center of the anchor to the transform origin.
 * @see https://floating-ui.com/docs/arrow
 */
function arrow(options: (state: MiddlewareState) => ArrowOptions): Middleware {
  return {
    name: 'arrow',
    async fn(state) {
      const { x, y, placement, rects, platform, elements, middlewareData } = state;
      const { element, padding } = evaluate(options, state);
      const paddingObject = getPaddingObject(element ? padding : 0);
      const axis = getAlignmentAxis(placement);
      const length = getAxisLength(axis);
      const coords = { x, y };
      const arrowSize = element
        ? await platform.getDimensions(element)
        : { width: 0, height: 0 };
      const minProp = axis === 'y' ? 'top' : 'left';
      const maxProp = axis === 'y' ? 'bottom' : 'right';
      const clientSize =
        elements.floating[axis === 'y' ? 'clientHeight' : 'clientWidth'] || rects.floating[length];
      const endDiff =
        rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
      const startDiff = coords[axis] - rects.reference[axis];
      const centerToReference = endDiff / 2 - startDiff / 2;
      // A large padding would move the arrow off the center.
      const largest = clientSize / 2 - arrowSize[length] / 2 - 1;
      const min = Math.min(paddingObject[minProp], largest);
      const maxPadding = Math.min(paddingObject[maxProp], largest);
      const max = clientSize - arrowSize[length] - maxPadding;
      const center = clientSize / 2 - arrowSize[length] / 2 + centerToReference;
      const place = clamp(min, center, max);
      // On a small anchor, the arrow of an aligned popup can point at nothing. The popup then moves
      // one time, and `shift()` still acts.
      const moves =
        !!element &&
        !middlewareData.arrow &&
        getAlignment(placement) != null &&
        center !== place &&
        rects.reference[length] / 2 - (center < min ? min : maxPadding) - arrowSize[length] / 2 < 0;
      const alignmentOffset = moves ? (center < min ? center - min : center - max) : 0;
      return {
        [axis]: coords[axis] + alignmentOffset,
        data: {
          [axis]: place,
          centerOffset: center - place - alignmentOffset,
          ...(moves && { alignmentOffset }),
        },
        reset: moves,
      };
    },
  };
}

/**
 * The `--transform-origin` of the popup: the arrow, or the aligned edge of a popup with no arrow, on
 * the align axis; the edge that faces the anchor on the side axis.
 */
function transformOrigin(
  options: () => {
    arrow: HTMLElement | null;
    sideOffset: (state: MiddlewareState) => number;
    shiftsCrossAxis: boolean;
  },
): Middleware {
  return {
    name: 'transformOrigin',
    fn(state) {
      const { elements, middlewareData: data, placement, platform, rects, y } = state;
      const { arrow: arrowElement, sideOffset, shiftsCrossAxis } = options();
      const side = getSide(placement);
      const align = getAlignment(placement);
      const vertical = getSideAxis(side) === 'y';
      const gap = sideOffset(state);
      let cross: string;
      // An aligned popup with no arrow grows from its aligned edge, until a shift of more than
      // 1 px breaks the alignment.
      if (!arrowElement && align && Math.abs(vertical ? data.shift?.x || 0 : data.shift?.y || 0) <= 1) {
        cross = (align === 'start') === (vertical && platform.isRTL?.(elements.floating) === true) ? '100%' : '0%';
      } else {
        const at = vertical ? data.arrow?.x || 0 : data.arrow?.y || 0;
        const length = vertical ? arrowElement?.clientWidth || 0 : arrowElement?.clientHeight || 0;
        cross = `${at + length / 2}px`;
      }
      let along = side === 'top' || side === 'left' ? `calc(100% + ${gap}px)` : `${-gap}px`;
      // A popup that a shift moved over its anchor grows from the center of the anchor.
      if (shiftsCrossAxis && vertical && Math.abs(data.shift?.y || 0) > gap) {
        along = `${rects.reference.y + rects.reference.height / 2 - y}px`;
      }
      return { data: { value: vertical ? `${cross} ${along}` : `${along} ${cross}` } };
    },
  };
}

/**
 * The `referenceHidden` strategy of `hide()` of Floating UI. An anchor with `display: none` has a
 * rectangle of zeros, and it is hidden too.
 */
const hide: Middleware = {
  name: 'hide',
  async fn(state) {
    const { width, height, x, y } = state.rects.reference;
    const overflow = await state.platform.detectOverflow(state, { elementContext: 'reference' });
    const clipped =
      overflow.top - height >= 0 ||
      overflow.right - width >= 0 ||
      overflow.bottom - height >= 0 ||
      overflow.left - width >= 0;
    return {
      data: { referenceHidden: clipped || (width === 0 && height === 0 && x === 0 && y === 0) },
    };
  },
};

interface Insets {
  x: 'left' | 'right';
  y: 'top' | 'bottom';
}

/**
 * Gives the place as insets from the edges of the offset parent that face the anchor. A popup that
 * changes its size then grows away from its anchor.
 */
const insets: Middleware = {
  name: 'insets',
  async fn({ x, y, rects, elements, platform, strategy, placement }) {
    const win = ownerWindow(elements.floating);
    const parent = await platform.getOffsetParent?.(elements.floating);
    let box = { width: 0, height: 0 };
    if (strategy === 'fixed' && win.visualViewport) {
      box = { width: win.visualViewport.width, height: win.visualViewport.height };
    } else if (parent === win) {
      const html = elements.floating.ownerDocument.documentElement;
      box = { width: html.clientWidth, height: html.clientHeight };
    } else if (await platform.isElement?.(parent)) {
      box = await platform.getDimensions(parent as Element);
    }
    const side = getSide(placement);
    const data: Insets = {
      x: side === 'left' ? 'right' : 'left',
      y: side === 'top' ? 'bottom' : 'top',
    };
    return {
      x: side === 'left' ? box.width - (x + rects.floating.width) : x,
      y: side === 'top' ? box.height - (y + rects.floating.height) : y,
      data,
    };
  },
};
