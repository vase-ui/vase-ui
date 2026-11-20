<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FocusOption } from '../../utils/popups/focus/usePopupFocus';

export interface SelectPopupState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectPopupProps
  extends
    VaseUIComponentProps<SelectPopupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Determines the element to focus when the select popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element, a component, or a ref of one: Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusOption | undefined;
}
</script>

<script setup lang="ts">
import { popupBindings } from '../../utils/popups/popupBindings';
import { platform as floatingPlatform } from '@floating-ui/vue';
import { rectToClientRect } from '@floating-ui/utils';
import type { ClientRectObject } from '@floating-ui/utils';
import { computed, nextTick, onScopeDispose } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { clamp } from '../../common/clamp';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { platform } from '../../common/platform';
import { useAnimationFrame } from '../../common/useAnimationFrame';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps, VaseUIEvent } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { usePopupFocus } from '../../utils/popups/focus/usePopupFocus';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useDomEffect } from '../../utils/popups/useDomEffect';
import { createElementSetter, popupElementTarget } from '../../utils/popups/createElementSetter';
import { getMaxScrollOffset, SCROLL_EDGE_TOLERANCE_PX } from '../../utils/scrollEdges';
import { styleDisableScrollbar, useStyleDisableScrollbar } from '../../utils/styles';
import * as SelectPositionerCssVars from '../positioner/SelectPositionerCssVars';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useSelectRootContext } from '../root/SelectRootContext';
import { LIST_FUNCTIONAL_STYLES } from './utils';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectPopupProps>(), {
  as: 'div',
  finalFocus: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Select.Popup');
}

defineSlots<{
  default(props: { state: SelectPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectPopupState>;
}>();

const store = useSelectRootContext();
const {
  side,
  align,
  itemAlignment,
  alignItemWithTriggerActive,
  isPositioned,
  setControlledAlignItemWithTrigger,
} = useSelectPositionerContext();
const direction = useDirection();

const open = computed(() => store.select('open'));
const mounted = computed(() => store.select('mounted'));
const transitionStatus = computed(() => store.select('transitionStatus'));

let reachedMaxHeight = false;
let initialPlaced = false;
let pinnedEdge: 'top' | 'bottom' | null = null;

const scrollArrowFrame = useAnimationFrame();

function handleScroll(scroller: HTMLDivElement) {
  const positionerElement = store.select('positionerElement');
  const popupElement = store.context.popupRef.value;
  if (!positionerElement || !popupElement || popupElement !== element.value || !initialPlaced) {
    return;
  }

  const alignment = itemAlignment.value;
  const isTopPositioned = pinnedEdge === 'top';
  if (reachedMaxHeight || !alignItemWithTriggerActive.value || !pinnedEdge || !alignment) {
    store.context.handleScrollArrowVisibility(scroller);
    return;
  }

  const scale = getScale(positionerElement);
  const currentHeight = normalizeSize(positionerElement.getBoundingClientRect().height, 'y', scale);
  const doc = ownerDocument(positionerElement);
  const win = ownerWindow(positionerElement);
  const positionerStyles = win.getComputedStyle(positionerElement);
  const marginTop = parseFloat(positionerStyles.marginTop);
  const marginBottom = parseFloat(positionerStyles.marginBottom);
  const maxPopupHeight = getMaxPopupHeight(win.getComputedStyle(popupElement));
  const maxAvailableHeight = Math.min(
    doc.documentElement.clientHeight - marginTop - marginBottom,
    maxPopupHeight,
  );

  const scrollTop = scroller.scrollTop;
  const maxScrollTop = getMaxScrollTop(scroller);

  // `Infinity` requests a scroll to the recomputed maximum offset.
  let nextScrollTop: number | null = null;

  const setHeight = (height: number) => {
    itemAlignment.value = {
      ...alignment,
      positionerStyle: { ...alignment.positionerStyle, height: `${height}px` },
    };
  };

  const diff = isTopPositioned ? maxScrollTop - scrollTop : scrollTop;
  const nextHeight = Math.min(currentHeight + diff, maxAvailableHeight);

  if (diff <= SCROLL_EDGE_TOLERANCE_PX) {
    const heightDelta = clamp(diff, 0, maxAvailableHeight - currentHeight);
    if (heightDelta > 0) {
      // Consume the remaining scroll in height.
      setHeight(currentHeight + heightDelta);
    }
    nextScrollTop = isTopPositioned ? Infinity : 0;
    if (maxAvailableHeight - (currentHeight + heightDelta) <= SCROLL_EDGE_TOLERANCE_PX) {
      reachedMaxHeight = true;
    }
  } else {
    if (maxAvailableHeight - nextHeight > SCROLL_EDGE_TOLERANCE_PX) {
      nextScrollTop = isTopPositioned ? Infinity : 0;
    } else if (!isTopPositioned && scrollTop < maxScrollTop) {
      const overshoot = currentHeight + diff - maxAvailableHeight;
      nextScrollTop = scrollTop - (diff - overshoot);
    }

    const nextPositionerHeight = Math.ceil(nextHeight);
    if (nextPositionerHeight !== 0) {
      setHeight(nextPositionerHeight);
    }
    if (nextPositionerHeight >= maxAvailableHeight - SCROLL_EDGE_TOLERANCE_PX) {
      reachedMaxHeight = true;
    }
  }

  const resized = itemAlignment.value;
  void nextTick(() => {
    if (itemAlignment.value !== resized || !open.value || !scroller.isConnected) {
      return;
    }
    if (nextScrollTop != null) {
      const target = clamp(nextScrollTop, 0, getMaxScrollTop(scroller));
      const tolerance = diff <= SCROLL_EDGE_TOLERANCE_PX ? 0 : SCROLL_EDGE_TOLERANCE_PX;
      if (Math.abs(scroller.scrollTop - target) > tolerance) {
        scroller.scrollTop = target;
      }
    }
    store.context.handleScrollArrowVisibility(scroller);
  });
}

// `Select.List` calls the handler for its own scroll.
store.context.scrollHandlerRef.value = handleScroll;
onScopeDispose(() => {
  if (store.context.scrollHandlerRef.value === handleScroll) {
    store.context.scrollHandlerRef.value = null;
  }
});

const state = computed<SelectPopupState>(() => ({
  open: open.value,
  transitionStatus: transitionStatus.value,
  side: side.value,
  align: align.value,
}));

function placePopup(signal: AbortSignal) {
  const positionerElement = store.select('positionerElement');
  const popupElement = element.value;
  const triggerElement = store.select('triggerElement');
  const listElement = store.select('listElement');
  const isAligned = alignItemWithTriggerActive.value;

  if (!isAligned) {
    itemAlignment.value = null;
    pinnedEdge = null;
    reachedMaxHeight = false;
    initialPlaced = false;
  }

  // Wait for Floating UI's first positioning pass before reading DOM geometry.
  // We replace the final coordinates for aligned selects, but still need middleware
  // like `size()` to set CSS variables such as `--anchor-width`.
  if (
    !open.value ||
    !triggerElement ||
    !positionerElement ||
    !popupElement ||
    popupElement !== store.context.popupRef.value ||
    // `KeepAlive` takes the trigger out of the document before it calls `onDeactivated`, and this
    // effect can run in that gap. The trigger then has no geometry, so the fallback below would turn
    // the alignment off for the rest of the open. `onActivated` runs this effect again.
    !triggerElement.isConnected ||
    (isAligned && !isPositioned.value) ||
    store.select('transitionStatus') === 'ending'
  ) {
    return;
  }

  initialPlaced = !isAligned;

  if (!isAligned) {
    // The wrapper supplies the scroller: the list owns scrolling once it has mounted, and
    // this effect re-runs (cancelling the stale frame) when that happens.
    scrollArrowFrame.request(() =>
      store.context.handleScrollArrowVisibility(listElement || popupElement),
    );
    return;
  }

  // Ensure we remove any transforms that can affect the location of the popup
  // and therefore the calculations.
  const restoreTransformStyles = unsetTransformStyles(popupElement);

  try {
    let textElement = store.context.selectedItemTextRef.value;

    if (!textElement?.isConnected) {
      const hasSelectedValue = store.select('hasSelectedValue');
      textElement =
        !hasSelectedValue && store.context.firstItemTextRef.value?.isConnected
          ? store.context.firstItemTextRef.value
          : null;
    }

    const valueElement = store.context.valueRef.value;

    const win = ownerWindow(positionerElement);
    const positionerStyles = win.getComputedStyle(positionerElement);
    const popupStyles = win.getComputedStyle(popupElement);

    const doc = ownerDocument(triggerElement);
    const scale = getScale(triggerElement);
    const triggerRect = normalizeRect(triggerElement.getBoundingClientRect(), scale);

    const positionerRect = normalizeRect(positionerElement.getBoundingClientRect(), scale);
    const triggerHeight = triggerRect.height;
    const scroller = listElement || popupElement;
    const scrollHeight = scroller.scrollHeight;

    const borderBottom = parseFloat(popupStyles.borderBottomWidth);
    // The `|| N` fallbacks cover an unset/`auto` value (parses to `NaN`). Note a literal `0`
    // also resolves to the fallback, so an explicit `margin: 0` or `min-height: 0` still takes
    // the default below.
    const marginTop = parseFloat(positionerStyles.marginTop) || 10;
    const marginBottom = parseFloat(positionerStyles.marginBottom) || 10;
    const minHeight = parseFloat(positionerStyles.minHeight) || 100;
    const maxPopupHeight = getMaxPopupHeight(popupStyles);

    const paddingLeft = 5;
    const paddingRight = 5;
    const triggerCollisionThreshold = 20;

    const viewportHeight = doc.documentElement.clientHeight - marginTop - marginBottom;
    const viewportWidth = doc.documentElement.clientWidth;
    const availableSpaceBeneathTrigger = viewportHeight - triggerRect.bottom + triggerHeight;
    const rtl = direction.value === 'rtl';

    let textRect: ClientRectObject | undefined;
    let alignedLeft = rtl ? triggerRect.right - positionerRect.width : triggerRect.left;
    let offsetY = 0;

    if (textElement && valueElement) {
      const valueRect = normalizeRect(valueElement.getBoundingClientRect(), scale);
      textRect = normalizeRect(textElement.getBoundingClientRect(), scale);

      alignedLeft =
        positionerRect.left +
        (rtl ? valueRect.right - textRect.right : valueRect.left - textRect.left);
      const valueCenterFromTriggerTop = valueRect.top - triggerRect.top + valueRect.height / 2;
      const textCenterFromPositionerTop = textRect.top - positionerRect.top + textRect.height / 2;

      offsetY = textCenterFromPositionerTop - valueCenterFromTriggerTop;
    }

    const idealHeight = availableSpaceBeneathTrigger + offsetY + marginBottom + borderBottom;
    let height = Math.min(viewportHeight, idealHeight);
    const maxHeight = viewportHeight - marginTop - marginBottom;
    const scrollTop = idealHeight - height;

    const maxRight = viewportWidth - paddingRight;

    const positionerStyle = {
      left: `${clamp(alignedLeft, paddingLeft, maxRight - positionerRect.width)}px`,
      height: `${height}px`,
      maxHeight: 'none',
      marginTop: `${marginTop}px`,
      marginBottom: `${marginBottom}px`,
    };
    const transformOrigin = textRect
      ? `50% ${clamp(
          positionerRect.height > 0
            ? ((textRect.top + textRect.height / 2 - positionerRect.top) / positionerRect.height) *
                100
            : 50,
          0,
          100,
        )}%`
      : undefined;
    itemAlignment.value = { popup: popupElement, positionerStyle, transformOrigin };

    // The list scroll range depends on the height that Vue just received.
    void nextTick(() => {
      if (signal.aborted || !open.value || !triggerElement.isConnected) {
        return;
      }
      const maxScrollTop = getMaxScrollTop(scroller);
      const isTopPositioned = scrollTop >= maxScrollTop - SCROLL_EDGE_TOLERANCE_PX;

      if (isTopPositioned) {
        height = Math.min(viewportHeight, positionerRect.height) - (scrollTop - maxScrollTop);
      }

      // When the trigger is too close to the top or bottom of the viewport, or the minHeight is
      // reached, we fallback to aligning the popup to the trigger as the UX is poor otherwise.
      const fallbackToAlignPopupToTrigger =
        triggerRect.top < triggerCollisionThreshold ||
        triggerRect.bottom > viewportHeight - triggerCollisionThreshold ||
        Math.ceil(height) + SCROLL_EDGE_TOLERANCE_PX < Math.min(scrollHeight, minHeight);

      // Safari doesn't position the popup correctly when pinch-zoomed.
      const isPinchZoomed = (win.visualViewport?.scale ?? 1) !== 1 && platform.engine.webkit;

      if (fallbackToAlignPopupToTrigger || isPinchZoomed) {
        itemAlignment.value = null;
        setControlledAlignItemWithTrigger(false);
        return;
      }

      const initialHeight = Math.max(minHeight, height);

      const top =
        positionerRect.height >= maxHeight ? 0 : Math.max(0, viewportHeight - idealHeight);
      pinnedEdge = isTopPositioned ? (top === 0 ? 'top' : null) : 'bottom';
      const placed = {
        popup: popupElement,
        positionerStyle: {
          ...positionerStyle,
          height: `${height}px`,
          ...(isTopPositioned ? { top: `${top}px` } : { bottom: '0' }),
        },
        transformOrigin,
      };
      itemAlignment.value = placed;
      void nextTick(() => {
        if (
          signal.aborted ||
          itemAlignment.value !== placed ||
          !open.value ||
          !triggerElement.isConnected
        ) {
          return;
        }
        initialPlaced = true;
        scroller.scrollTop = isTopPositioned ? getMaxScrollTop(scroller) : scrollTop;
        store.context.handleScrollArrowVisibility(scroller);
      });

      if (initialHeight === viewportHeight || height >= maxPopupHeight) {
        reachedMaxHeight = true;
      }

      if (
        store.select('highlightItemOnHover') &&
        store.select('selectedIndex') === null &&
        store.select('activeIndex') === null &&
        store.context.listRef.value[0] != null
      ) {
        store.set('activeIndex', 0);
      }
    });
  } finally {
    restoreTransformStyles();
  }
}

useDomEffect(
  [
    () => open.value,
    () => store.select('positionerElement'),
    () => store.select('triggerElement'),
    () => alignItemWithTriggerActive.value,
    () => store.select('listElement'),
    () => store.select('highlightItemOnHover'),
    () => direction.value,
    () => isPositioned.value,
    () => store.context.popupRef.value,
  ],
  () => {
    const controller = new AbortController();
    placePopup(controller.signal);
    const popup = element.value;
    return () => {
      controller.abort();
      scrollArrowFrame.cancel();
      if (
        itemAlignment.value?.popup === popup &&
        (!popup?.isConnected || store.context.popupRef.value !== popup)
      ) {
        itemAlignment.value = null;
        pinnedEdge = null;
        reachedMaxHeight = false;
      }
    };
  },
);

useDomEffect(
  [
    () => alignItemWithTriggerActive.value,
    () => store.select('positionerElement'),
    () => open.value,
  ],
  () => {
    const positionerElement = store.select('positionerElement');
    if (!alignItemWithTriggerActive.value || !positionerElement || !open.value) {
      return undefined;
    }

    return addEventListener(ownerWindow(positionerElement), 'resize', (event: UIEvent) => {
      store.setOpen(false, createChangeEventDetails(REASONS.windowResize, event));
    });
  },
);

const listProps = computed(() =>
  store.select('listElement')
    ? { role: 'presentation' }
    : {
        role: 'listbox',
        'aria-multiselectable': store.select('multiple') || undefined,
        'aria-readonly': store.select('readOnly') || undefined,
        id: `${store.select('id')}-list`,
      },
);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  SelectPopupState,
  HTMLElement
>('div', props, {
  state,
  ref: createElementSetter(popupElementTarget(store)),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => {
    const hasList = store.select('listElement') !== null;
    const isAligned = alignItemWithTriggerActive.value;
    return [
      popupBindings(store),
      {
        ...listProps.value,
        onKeydown(event: VaseUIEvent<KeyboardEvent>) {
          // The handlers to the left also handle the keys of the items. A call of
          // `event.preventVaseUIHandler()` in a listener of an item thus stops them too.
          if (event.vaseUIHandlerPrevented) {
            event.preventVaseUIHandler();
          }
        },
        onScroll(event: Event) {
          if (store.select('listElement')) {
            return;
          }
          handleScroll(event.currentTarget as HTMLDivElement);
        },
        style: isAligned
          ? {
              ...(!hasList && LIST_FUNCTIONAL_STYLES),
              height: itemAlignment.value?.positionerStyle.height ? '100%' : undefined,
              [SelectPositionerCssVars.transformOrigin]: itemAlignment.value?.transformOrigin,
            }
          : undefined,
        class: !hasList && isAligned ? styleDisableScrollbar.className : undefined,
      },
      getDisabledMountTransitionStyles(transitionStatus.value),
      focusBindings(attrs),
      attrs,
    ];
  },
});

// `StyleDisableScrollbar` in `Select.Positioner` gives the server HTML its style element. A popup
// that is not in a portal is in the server HTML, and it hides its native scrollbar before the page
// hydrates.
useStyleDisableScrollbar(element);

const focusBindings = usePopupFocus(
  () => ({
    store,
    modal: false,
    disabled: !mounted.value,
    openInteractionType: store.select('openMethod'),
    returnFocus: props.finalFocus,
    restoreFocus: true,
  }),
  element,
);

defineExpose({ element });

function getMaxPopupHeight(popupStyles: CSSStyleDeclaration) {
  const maxHeightStyle = popupStyles.maxHeight;
  return maxHeightStyle.endsWith('px') ? parseFloat(maxHeightStyle) || Infinity : Infinity;
}

function getMaxScrollTop(scroller: HTMLElement) {
  return getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
}

function getScale(element: HTMLElement) {
  // The platform API is async-capable, but the DOM platform returns a plain scale object.
  return floatingPlatform.getScale(element) as { x: number; y: number };
}

function normalizeSize(size: number, axis: 'x' | 'y', scale: { x: number; y: number }) {
  return size / scale[axis];
}

function normalizeRect(
  rect: DOMRect | DOMRectReadOnly,
  scale: { x: number; y: number },
): ClientRectObject {
  return rectToClientRect({
    x: normalizeSize(rect.x, 'x', scale),
    y: normalizeSize(rect.y, 'y', scale),
    width: normalizeSize(rect.width, 'x', scale),
    height: normalizeSize(rect.height, 'y', scale),
  });
}

const TRANSFORM_STYLE_RESETS = [
  ['transform', 'none'],
  ['scale', '1'],
  ['translate', '0 0'],
] as const;

type TransformStyleProperty = (typeof TRANSFORM_STYLE_RESETS)[number][0];

function unsetTransformStyles(popup: HTMLElement) {
  const { style } = popup;
  const originalStyles = {} as Record<TransformStyleProperty, { value: string; priority: string }>;

  for (const [property, value] of TRANSFORM_STYLE_RESETS) {
    originalStyles[property] = {
      value: style.getPropertyValue(property),
      priority: style.getPropertyPriority(property),
    };
    style.setProperty(property, value, 'important');
  }

  return () => {
    for (const [property] of TRANSFORM_STYLE_RESETS) {
      const { value, priority } = originalStyles[property];
      if (value) {
        style.setProperty(property, value, priority);
      } else {
        style.removeProperty(property);
      }
    }
  };
}
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
