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
  platform,
  shift,
  size,
  useFloating,
  type ElementRects,
  type Middleware,
  type MiddlewareState,
  type Padding,
  type Placement,
  type Side as PhysicalSide,
  type VirtualElement,
} from '@floating-ui/vue';

import { computed, shallowRef, watch, type CSSProperties, type Ref } from 'vue';
import { mergeCleanups } from '../common/mergeCleanups';
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
  side?: 'flip' | 'shift' | 'none' | undefined;
  /**
   * The align axis: `'flip'` swaps `start` and `end` when the popup has no room, `'shift'` keeps
   * the alignment and moves the popup into the boundary, `'none'` does nothing.
   */
  align?: 'flip' | 'shift' | 'none' | undefined;
  /**
   * With no room on both sides of the preferred axis, the popup can go to a side of the other
   * axis: the logical `'start'` or `'end'` first, or `'none'`.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

export interface PlacementProps {
  /**
   * The side of the anchor for the popup. It can change to avoid a collision. `inline-start` and
   * `inline-end` follow the CSS `direction` of the positioner: give the positioner `dir` when the
   * target of its portal has another direction.
   * @default 'bottom'
   */
  side?: Side | undefined;
  /**
   * The alignment of the popup on the side.
   * @default 'center'
   */
  align?: Align | undefined;
  /**
   * The distance from the anchor in pixels, or a function that gives it.
   * @default 0
   */
  sideOffset?: number | OffsetFunction | undefined;
  /**
   * The offset on the align axis in pixels, or a function that gives it.
   * @default 0
   */
  alignOffset?: number | OffsetFunction | undefined;
  /**
   * The element to place the popup against: an element, a virtual element, a template ref of a
   * part, or a function that gives one. With no value, the active trigger.
   */
  anchor?: Anchor | (() => Anchor) | undefined;
  /** How the popup avoids the edge of the boundary. */
  collisionAvoidance?: CollisionAvoidance | undefined;
  /**
   * The area that holds the popup: an element, elements, or a rectangle.
   * @default 'clipping-ancestors'
   */
  collisionBoundary?: Boundary | undefined;
  /**
   * The space between the popup and the edge of the boundary, in pixels.
   * @default 5
   */
  collisionPadding?: Padding | undefined;
  /**
   * The popup stays in the view after its anchor scrolls out of it.
   * @default false
   */
  sticky?: boolean | undefined;
  /**
   * The smallest space between the arrow and an inner edge of its nearest positioned ancestor, in
   * pixels.
   * @default 5
   */
  arrowPadding?: number | undefined;
  /**
   * The CSS `position` of the positioner.
   * @default 'absolute'
   */
  positionMethod?: 'absolute' | 'fixed' | undefined;
  /**
   * The popup does not follow a move of its anchor.
   * @default false
   */
  disableAnchorTracking?: boolean | undefined;
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
  /**
   * The open state, the active trigger and the popup element. A placement with no popup root gives
   * them as values.
   */
  root: Pick<PopupRoot, 'open' | 'activeTrigger' | 'popup'>,
  props: Required<Omit<PlacementProps, 'anchor' | 'collisionAvoidance'>> &
    Pick<PlacementProps, 'anchor' | 'collisionAvoidance'>,
  options: {
    positioner: Readonly<Ref<HTMLElement | null>>;
    /** Places the positioner with insets from the edge that faces the anchor. */
    insets: () => boolean;
    /** The anchor while the `anchor` prop has no value. With none, the active trigger. */
    anchor?: () => VirtualElement | undefined;
    /** A middleware that runs first, before `flip()`: it can reset the rectangle of the anchor. */
    inline?: Middleware;
    /** The shift keeps the popup in the layout viewport, so a pinch zoom does not move it. */
    shiftInLayoutViewport?: boolean;
    /**
     * After a place, the popup keeps its side while it is open, so a list that filters its items
     * does not flip back at each change. `'placement'` also keeps the alignment.
     */
    lazyFlip?: () => boolean | 'placement';
    /** The popup moves across the side axis into the layout viewport. */
    shiftAcross?: () => boolean;
    /**
     * A place that the caller gives in the place of Floating UI, which then gives only the
     * variables. `null`: the caller has no place yet, and the positioner stays hidden.
     */
    place?: () => CSSProperties | null | undefined;
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
      () => resolveAnchor(props.anchor) ?? options.anchor?.(),
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
    props.collisionBoundary === 'clipping-ancestors'
      ? 'clippingAncestors'
      : props.collisionBoundary,
  );
  const sideMode = computed(() => props.collisionAvoidance?.side ?? 'flip');
  const alignMode = computed(() => props.collisionAvoidance?.align ?? 'flip');
  // The rectangles that the last place read.
  let placedRects = '';
  // The placement of the last place of an open, which a popup with `lazyFlip` keeps.
  const kept = shallowRef<Placement>();
  const placement = computed<Placement>(() => {
    const keptPlacement = kept.value;
    if (keptPlacement && options.lazyFlip?.() === 'placement') return keptPlacement;
    const side = keptPlacement ? getSide(keptPlacement) : physicalSide(props.side, rtl.value);
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
            // The layout viewport as the root boundary stops the popup from moving during a pinch
            // zoom.
            ...((options.shiftInLayoutViewport || options.shiftAcross?.()) && {
              rootBoundary: 'layoutViewport' as const,
            }),
            mainAxis: alignMode.value !== 'none',
            crossAxis: props.sticky || shiftsSide || !!options.shiftAcross?.(),
            limiter:
              props.sticky || options.shiftAcross?.()
                ? undefined
                : limitShift((state) => {
                    const arrow = arrowElement.value;
                    if (!arrow) return {};
                    const vertical = getSideAxis(getSide(state.placement)) === 'y';
                    const room = vertical
                      ? padding.value.left + padding.value.right
                      : padding.value.top + padding.value.bottom;
                    const size =
                      (vertical ? arrow.offsetWidth : arrow.offsetHeight) *
                      relativeZoom(arrow, state.elements.floating);
                    return { offset: size / 2 + room / 2 };
                  }),
          });
    // https://floating-ui.com/docs/flip#combining-with-shift
    const collision =
      shiftsSide || alignMode.value === 'shift' || props.align === 'center'
        ? [shifting, flipping]
        : [flipping, shifting];
    return [
      ...(options.inline ? [options.inline] : []),
      offset((state) => {
        const along = readOffset(props.alignOffset, state);
        return {
          mainAxis: readOffset(props.sideOffset, state),
          crossAxis: along,
          alignmentAxis: along,
        };
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
        },
      }),
      arrow(() => ({
        element: arrowElement.value,
        padding: props.arrowPadding,
      })),
      transformOrigin(() => ({
        arrow: arrowElement.value,
        popup: root.popup,
        sideOffset: (state: MiddlewareState) => readOffset(props.sideOffset, state),
        shiftsCrossAxis: props.sticky || shiftsSide,
      })),
      hide,
      insets(options.insets),
      {
        name: 'placedRects',
        fn({ rects }) {
          placedRects = rectsKey(rects);
          return {};
        },
      },
    ];
  });

  // Vapor sets a template ref before it inserts the element. Floating UI reads the ancestors of the
  // positioner, so the positioner goes to Floating UI after the render.
  const positioner = shallowRef<HTMLElement | null>(null);
  watch(options.positioner, (element) => (positioner.value = element), {
    flush: 'post',
    immediate: true,
  });
  const floating = useFloating(reference, positioner, {
    placement,
    strategy: () => props.positionMethod,
    middleware,
    whileElementsMounted: (anchor, element, update) => {
      // The popup stays at its place while its anchor is out of the document: after the trigger
      // left the DOM, and before an app in a detached element joins the document.
      const place = () => ('isConnected' in anchor && !anchor.isConnected ? undefined : update());
      const tracks = !props.disableAnchorTracking;
      const stopMoves = autoUpdate(anchor, element, place, {
        ancestorScroll: tracks,
        elementResize: false,
        layoutShift: tracks,
      });
      if (!tracks) return stopMoves;
      // The resize observer of Floating UI gives a first notice in the frame after the open, with
      // the rectangles of the first place. A notice places the popup only when a rectangle that a
      // place reads changed. A lock of the page after the first place can make `<body>` the
      // containing block of the positioner, and the rectangle of the anchor in it then changes.
      const placeIfChanged = async () => {
        const rects = await platform.getElementRects({
          reference: anchor,
          floating: element,
          strategy: props.positionMethod,
        });
        if (rectsKey(rects) !== placedRects) place();
      };
      // `autoUpdate` calls its function once at its start, and `stopMoves` placed the popup then.
      let started = false;
      const stopResizes = autoUpdate(
        anchor,
        element,
        () => {
          if (started) void placeIfChanged();
        },
        { ancestorScroll: false, ancestorResize: false, layoutShift: false },
      );
      started = true;
      return mergeCleanups(stopMoves, stopResizes);
    },
  });

  // The middleware reads these values only when it places the popup, so a change places an open
  // popup again.
  watch(
    [arrowElement, () => props.sideOffset, () => props.alignOffset, () => props.arrowPadding],
    () => {
      if (root.open) floating.update();
    },
  );

  // The first frame after an open shows the popup at its place (test/measurements/popup.test.ts),
  // so only the first placement hides the popup: the server HTML and the first render have no place.
  const placed = computed(() => {
    const given = options.place?.();
    return given === undefined ? floating.isPositioned.value : given !== null;
  });
  // Floating UI reads the layout before it gives a place. So at the first place of an open, the
  // browser has a style of the positioner at `0 0` or at its place of the last open, and of the
  // popup on the first side. The place then starts CSS transitions from these styles, such as of
  // `left` and of an `enter-from` class of the side (test/measurements/popup.test.ts, "the first
  // place of an open"). An open shows the popup at its place, so the positioner ends the
  // transitions that start from this place to the update that shows the popup. They include a
  // transition of `visibility`, which keeps the popup hidden and unfocusable
  // (test/measurements/popup.test.ts, "a change of an inherited property"). A place that the caller
  // gives can show the popup some updates later, as the item alignment of Select does. A transition
  // that started before the first place continues, such as the enter of a popup that loses
  // `hidden`. A later place of the open, such as at another trigger, keeps its transitions.
  let nextPlaceIsFirst = true;
  // The animations at the first place of the open, until the update that shows the popup.
  const firstPlaceAnimations = shallowRef<Set<Animation> | null>(null);
  watch(
    () => root.open,
    (open) => {
      if (open) nextPlaceIsFirst = true;
    },
    { flush: 'sync' },
  );
  // Floating UI sets `middlewareData` at each place.
  watch(
    floating.middlewareData,
    () => {
      const element = options.positioner.value;
      if (!nextPlaceIsFirst || !element) return;
      nextPlaceIsFirst = false;
      // Vue renders the place after this watcher.
      firstPlaceAnimations.value = new Set(element.getAnimations({ subtree: true }));
    },
    { flush: 'sync' },
  );
  // Only a caller with `lazyFlip` reads `placed` in its setup: the `place` of Select reads the
  // item alignment, which it sets up after this call.
  const { lazyFlip } = options;
  if (lazyFlip) {
    watch(
      [placed, () => root.open, floating.placement],
      ([isPlaced, open, current]) => {
        if (!open) kept.value = undefined;
        else if (isPlaced && lazyFlip()) kept.value = current;
      },
      { flush: 'sync' },
    );
  }

  const placedSide = computed(() => getSide(floating.placement.value));
  const side = computed(() => logicalSide(props.side, placedSide.value, rtl.value));
  const align = computed<Align>(() => getAlignment(floating.placement.value) ?? 'center');
  const anchorHidden = computed(() => !!floating.middlewareData.value.hide?.referenceHidden);

  const style = computed<CSSProperties>(() => {
    const given = options.place?.();
    const data = floating.middlewareData.value.insets as Insets | undefined;
    let place: CSSProperties = floating.floatingStyles.value;
    if (given !== undefined) place = { position: 'fixed' };
    else if (data?.x) {
      place = {
        position: floating.strategy.value,
        [data.x]: `${floating.x.value}px`,
        [data.y]: `${floating.y.value}px`,
      };
    }
    return {
      ...place,
      '--available-width': available.value.width,
      '--available-height': available.value.height,
      '--anchor-width': anchorSize.value?.width,
      '--anchor-height': anchorSize.value?.height,
      '--transform-origin': floating.middlewareData.value.transformOrigin?.value as
        string | undefined,
      visibility: placed.value ? undefined : 'hidden',
      ...given,
    };
  });
  // The style reads the `place` of Select, which Select sets up after this call. So the source
  // reads the style only after a first place.
  watch(
    () => {
      const animations = firstPlaceAnimations.value;
      return animations && style.value.visibility !== 'hidden' ? animations : null;
    },
    (animations) => {
      const element = options.positioner.value;
      if (!animations || !element) return;
      firstPlaceAnimations.value = null;
      endTransitions(element, animations);
    },
    { flush: 'post' },
  );

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
    /** The side with the text direction applied: `top`, `bottom`, `left` or `right`. */
    physicalSide: placedSide,
    align,
    anchorHidden,
    placed,
    /**
     * Floating UI gave a place, with its variables. A positioner that stays mounted after a close
     * keeps them until its next place.
     */
    anchored: floating.isPositioned,
    arrow: {
      style: arrowStyle,
      uncentered: arrowUncentered,
      /**
       * Gives the element of an arrow to the placement. The cleanup takes it back, unless a newer
       * arrow came: a replacement arrow can mount before the old one leaves.
       */
      addElement(element: HTMLElement) {
        arrowElement.value = element;
        return () => {
          if (arrowElement.value === element) arrowElement.value = null;
        };
      },
    },
  };
}

/**
 * Ends each CSS transition of the element and of its descendants that is not in `kept`. In
 * Chromium and WebKit, a change of an inherited property, such as `visibility`, starts a transition
 * only where the value changes, and the end of that transition starts the transitions of the
 * descendants (test/measurements/popup.test.ts, "a change of an inherited property").
 */
function endTransitions(element: Element, kept: Set<Animation>) {
  for (;;) {
    const started = element
      .getAnimations({ subtree: true })
      .filter((animation) => animation instanceof CSSTransition && !kept.has(animation));
    if (started.length === 0) return;
    for (const animation of started) animation.cancel();
  }
}

/** The rectangle of the anchor in the offset parent and the size of the positioner, as one value. */
function rectsKey({ reference, floating }: ElementRects) {
  return `${reference.x} ${reference.y} ${reference.width} ${reference.height} ${floating.width} ${floating.height}`;
}

interface ArrowOptions {
  element: HTMLElement | null;
  padding: number;
}

interface ArrowData {
  x?: number;
  y?: number;
  centerOffset: number;
  alignmentOffset?: number;
  /**
   * The center of the arrow on the align axis, from the border edge of the floating element, in
   * its pixels. With no arrow, the center of the anchor.
   */
  center: number;
}

/**
 * The size of a pixel of `element` in pixels of `ancestor`: the product of the CSS `zoom` of
 * `element` and of its ancestors in `ancestor`.
 */
export function relativeZoom(element: Element, ancestor: Element) {
  const win = ownerWindow(ancestor);
  let zoom = 1;
  for (let node: Element | null = element; node && node !== ancestor; node = node.parentElement) {
    zoom *= Number.parseFloat(win.getComputedStyle(node).zoom);
  }
  return zoom;
}

/**
 * The distance of the border edge of `element` from the border edge of the floating element on an
 * axis, in pixels of the floating element. An offset is in pixels of its own element
 * (test/measurements/popup.test.ts). The offsets ignore transforms.
 */
function offsetIn(element: HTMLElement, floating: HTMLElement, x: boolean) {
  let distance = 0;
  for (let node: HTMLElement | null = element; node && node !== floating;) {
    const parent = node.offsetParent as HTMLElement | null;
    distance += (x ? node.offsetLeft : node.offsetTop) * relativeZoom(node, floating);
    if (parent)
      distance += (x ? parent.clientLeft : parent.clientTop) * relativeZoom(parent, floating);
    node = parent;
  }
  return distance;
}

/**
 * The padding box of the nearest positioned ancestor of the arrow on an axis, in pixels of the
 * floating element: the distance of its start from the border edge of the floating element, its
 * length, and the size of its pixel. That ancestor is the popup when it has a `position`, else the
 * floating element. A transform also makes a static popup the containing block of the arrow, but
 * the transform of an enter animation ends (test/measurements/popup.test.ts), so the place skips a
 * static popup.
 */
function arrowContainingBlock(arrow: HTMLElement | null, floating: HTMLElement, axis: 'x' | 'y') {
  const x = axis === 'x';
  const win = ownerWindow(floating);
  let block = (arrow?.offsetParent ?? floating) as HTMLElement | null;
  while (block && block !== floating && win.getComputedStyle(block).position === 'static') {
    block = block.offsetParent as HTMLElement | null;
  }
  block ??= floating;
  const zoom = relativeZoom(block, floating);
  return {
    start: offsetIn(block, floating, x) + (x ? block.clientLeft : block.clientTop) * zoom,
    length: (x ? block.clientWidth : block.clientHeight) * zoom,
    zoom,
  };
}

/**
 * The `arrow()` of Floating UI. The place of the arrow is in the padding box of its nearest
 * positioned ancestor, so the borders and the place of that box in the floating element do not
 * move the arrow off the center. The place and `padding` are in pixels of that box, and a CSS
 * `zoom` in the floating element scales them. With no arrow, it gives the center of the anchor to
 * the transform origin.
 * @see https://floating-ui.com/docs/arrow
 */
function arrow(options: (state: MiddlewareState) => ArrowOptions): Middleware {
  return {
    name: 'arrow',
    async fn(state) {
      const { x, y, placement, rects, platform, elements, middlewareData } = state;
      const { element, padding } = evaluate(options, state);
      const axis = getAlignmentAxis(placement);
      const length = getAxisLength(axis);
      const coords = { x, y };
      const box = arrowContainingBlock(element, elements.floating, axis);
      const paddingObject = getPaddingObject(element ? padding * box.zoom : 0);
      const arrowZoom = element ? relativeZoom(element, elements.floating) : 1;
      const dimensions = element ? await platform.getDimensions(element) : { width: 0, height: 0 };
      const arrowLength = dimensions[length] * arrowZoom;
      const minProp = axis === 'y' ? 'top' : 'left';
      const maxProp = axis === 'y' ? 'bottom' : 'right';
      const clientSize = box.length || rects.floating[length];
      // A large padding would move the arrow off the center.
      const largest = clientSize / 2 - arrowLength / 2 - 1;
      const min = Math.min(paddingObject[minProp], largest);
      const maxPadding = Math.min(paddingObject[maxProp], largest);
      const max = clientSize - arrowLength - maxPadding;
      const referenceCenter =
        rects.reference[axis] + rects.reference[length] / 2 - coords[axis] - box.start;
      const center = referenceCenter - arrowLength / 2;
      const place = clamp(min, center, max);
      // On a small anchor, the arrow of an aligned popup can point at nothing. The popup then moves
      // one time, and `shift()` still acts.
      const moves =
        !!element &&
        !middlewareData.arrow &&
        getAlignment(placement) != null &&
        center !== place &&
        rects.reference[length] / 2 - (center < min ? min : maxPadding) - arrowLength / 2 < 0;
      const alignmentOffset = moves ? (center < min ? center - min : center - max) : 0;
      const data: ArrowData = {
        // The `left` or the `top` of the arrow, in its own pixels.
        [axis]: place / arrowZoom,
        centerOffset: center - place - alignmentOffset,
        ...(moves && { alignmentOffset }),
        center: box.start + place + arrowLength / 2,
      };
      return { [axis]: coords[axis] + alignmentOffset, data, reset: moves };
    },
  };
}

/**
 * The `--transform-origin` of the popup, in the pixels and from the border edge of the popup: the
 * center of the arrow, or the aligned edge of a popup with no arrow, on the align axis; the edge of
 * the anchor that faces the popup on the side axis.
 */
function transformOrigin(
  options: () => {
    arrow: HTMLElement | null;
    popup: HTMLElement | null;
    sideOffset: (state: MiddlewareState) => number;
    shiftsCrossAxis: boolean;
  },
): Middleware {
  return {
    name: 'transformOrigin',
    fn(state) {
      const { elements, middlewareData: data, placement, platform, rects, y } = state;
      const { arrow: arrowElement, popup: popupElement, sideOffset, shiftsCrossAxis } = options();
      const floating = elements.floating;
      const popup = popupElement ?? floating;
      const zoom = relativeZoom(popup, floating);
      const side = getSide(placement);
      const align = getAlignment(placement);
      const vertical = getSideAxis(side) === 'y';
      const gap = sideOffset(state);
      // The start of the popup in the floating element, on the align axis and on the side axis.
      const crossStart = offsetIn(popup, floating, vertical);
      const alongStart = offsetIn(popup, floating, !vertical);
      let cross: string;
      // An aligned popup with no arrow grows from its aligned edge, until a shift of more than
      // 1 px breaks the alignment.
      if (
        !arrowElement &&
        align &&
        Math.abs(vertical ? data.shift?.x || 0 : data.shift?.y || 0) <= 1
      ) {
        cross =
          (align === 'start') === (vertical && platform.isRTL?.(floating) === true) ? '100%' : '0%';
      } else {
        const center = (data.arrow as ArrowData | undefined)?.center ?? 0;
        cross = `${(center - crossStart) / zoom}px`;
      }
      let along: string;
      if (side === 'top' || side === 'left') {
        // The space between the end edges of the popup and of the floating element.
        const end =
          (vertical ? floating.offsetHeight : floating.offsetWidth) -
          alongStart -
          (vertical ? popup.offsetHeight : popup.offsetWidth) * zoom;
        along = `calc(100% + ${(end + gap) / zoom}px)`;
      } else along = `${-(alongStart + gap) / zoom}px`;
      // A popup that a shift moved over its anchor grows from the center of the anchor.
      if (shiftsCrossAxis && vertical && Math.abs(data.shift?.y || 0) > gap) {
        along = `${(rects.reference.y + rects.reference.height / 2 - y - alongStart) / zoom}px`;
      }
      return { data: { value: vertical ? `${cross} ${along}` : `${along} ${cross}` } };
    },
  };
}

// A popup that covers the view leaves no room for a swipe outside, so a touch open locks the page.
const FULL_WIDTH_TOLERANCE = 20;

/** The placed positioner is as wide as the view, within 20 px. */
export function useFullWidth(
  positioner: Readonly<Ref<HTMLElement | null>>,
  placed: Readonly<Ref<boolean>>,
) {
  const fullWidth = shallowRef(false);
  watch(placed, (isPlaced) => {
    const element = positioner.value;
    fullWidth.value =
      isPlaced &&
      !!element &&
      element.offsetWidth >=
        element.ownerDocument.documentElement.clientWidth - FULL_WIDTH_TOLERANCE;
  });
  return fullWidth;
}

/**
 * The `referenceHidden` strategy of `hide()` of Floating UI. An anchor with `display: none` has a
 * rectangle of zeros, and it is hidden too.
 */
export const hide: Middleware = {
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
 * Gives the place as insets from the edges of the offset parent that face the anchor, while
 * `enabled` gives `true`. A popup that changes its size then grows away from its anchor. The
 * middleware reads `enabled` when it places, because a popup part mounts its content, such as a
 * viewport, after the call that starts the first place.
 */
const insets = (enabled: () => boolean): Middleware => ({
  name: 'insets',
  async fn({ x, y, rects, elements, platform, strategy, placement }) {
    if (!enabled()) return {};
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
    if (parent === win) {
      // Floating UI gives `x` and `y` in pixels of the floating element, which a CSS `zoom` makes
      // differ from the pixels of the view. Its conversion gives the size of one such pixel.
      const pixel = await platform.convertOffsetParentRelativeRectToViewportRelativeRect?.({
        elements,
        rect: { x: 0, y: 0, width: 1, height: 1 },
        offsetParent: win,
        strategy,
      });
      const scale = pixel?.width || 1;
      box = { width: box.width / scale, height: box.height / scale };
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
});
