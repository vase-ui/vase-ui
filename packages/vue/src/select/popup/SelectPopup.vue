<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FocusOption } from '../../utils/popups/focus/FloatingFocusManager.vue';

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
import { platform as floatingPlatform } from '@floating-ui/vue';
import { rectToClientRect } from '@floating-ui/utils';
import type { ClientRectObject } from '@floating-ui/utils';
import { computed, onScopeDispose } from 'vue';
import type { CSSProperties } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { clamp } from '../../common/clamp';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { platform } from '../../common/platform';
import { useAnimationFrame } from '../../common/useAnimationFrame';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import FloatingFocusManager from '../../utils/popups/focus/FloatingFocusManager.vue';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useDomEffect } from '../../utils/popups/useDomEffect';
import { getMaxScrollOffset, SCROLL_EDGE_TOLERANCE_PX } from '../../utils/scrollEdges';
import StyleDisableScrollbar from '../../utils/StyleDisableScrollbar.vue';
import { styleDisableScrollbar, useStyleDisableScrollbar } from '../../utils/styles';
import * as SelectPositionerCssVars from '../positioner/SelectPositionerCssVars';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useSelectRootContext } from '../root/SelectRootContext';
import { clearStyles, LIST_FUNCTIONAL_STYLES } from './utils';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectPopupProps>(), {
  as: 'div',
  finalFocus: undefined,
});

defineSlots<{
  default(props: { state: SelectPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectPopupState>;
}>();

const store = useSelectRootContext();
const { side, align, alignItemWithTriggerActive, isPositioned, setControlledAlignItemWithTrigger } =
  useSelectPositionerContext();
const insideToolbar = useToolbarRootContext(true) !== undefined;
const direction = useDirection();

const open = computed(() => store.select('open'));
const mounted = computed(() => store.select('mounted'));
const transitionStatus = computed(() => store.select('transitionStatus'));

let reachedMaxHeight = false;
let initialPlaced = false;
let originalPositionerStyles: CSSProperties = {};

const scrollArrowFrame = useAnimationFrame();

function handleScroll(scroller: HTMLDivElement) {
  const positionerElement = store.select('positionerElement');
  const popupElement = store.context.popupRef.value;
  if (!positionerElement || !popupElement || !initialPlaced) {
    return;
  }

  const isTopPositioned = positionerElement.style.top === '0px';
  const isBottomPositioned = positionerElement.style.bottom === '0px';

  if (
    reachedMaxHeight ||
    !alignItemWithTriggerActive.value ||
    (!isTopPositioned && !isBottomPositioned)
  ) {
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
    positionerElement.style.height = `${height}px`;
  };

  const diff = isTopPositioned ? maxScrollTop - scrollTop : scrollTop;
  const nextHeight = Math.min(currentHeight + diff, maxAvailableHeight);

  if (diff <= SCROLL_EDGE_TOLERANCE_PX) {
    const heightDelta = clamp(diff, 0, maxAvailableHeight - currentHeight);
    if (heightDelta > 0) {
      // Consume the remaining scroll in height.
      setHeight(currentHeight + heightDelta);
    }
    scroller.scrollTop = isTopPositioned ? maxScrollTop : 0;
    if (maxAvailableHeight - (currentHeight + heightDelta) <= SCROLL_EDGE_TOLERANCE_PX) {
      reachedMaxHeight = true;
    }
    store.context.handleScrollArrowVisibility(scroller);
    return;
  }

  if (maxAvailableHeight - nextHeight > SCROLL_EDGE_TOLERANCE_PX) {
    nextScrollTop = isTopPositioned ? Infinity : 0;
  } else if (isBottomPositioned && scrollTop < maxScrollTop) {
    const overshoot = currentHeight + diff - maxAvailableHeight;
    nextScrollTop = scrollTop - (diff - overshoot);
  }

  const nextPositionerHeight = Math.ceil(nextHeight);

  if (nextPositionerHeight !== 0) {
    setHeight(nextPositionerHeight);
  }

  if (nextScrollTop != null) {
    // Recompute bounds after resizing (clientHeight likely changed).
    const target = clamp(nextScrollTop, 0, getMaxScrollTop(scroller));

    // Avoid adjustments that re-trigger scroll events forever.
    if (Math.abs(scroller.scrollTop - target) > SCROLL_EDGE_TOLERANCE_PX) {
      scroller.scrollTop = target;
    }
  }

  if (nextPositionerHeight >= maxAvailableHeight - SCROLL_EDGE_TOLERANCE_PX) {
    reachedMaxHeight = true;
  }

  store.context.handleScrollArrowVisibility(scroller);
}

// `Select.List` calls the handler for its own scroll.
store.context.scrollHandlerRef.value = handleScroll;
onScopeDispose(() => {
  if (store.context.scrollHandlerRef.value === handleScroll) {
    store.context.scrollHandlerRef.value = null;
  }
});

useOpenChangeComplete({
  open,
  ref: store.context.popupRef,
  onComplete() {
    if (open.value) {
      store.context.onOpenChangeComplete?.(true);
    }
  },
});

const state = computed<SelectPopupState>(() => ({
  open: open.value,
  transitionStatus: transitionStatus.value,
  side: side.value,
  align: align.value,
}));

function recordOriginalPositionerStyles(positionerElement: HTMLElement | null) {
  if (
    !positionerElement ||
    !store.context.popupRef.value ||
    Object.keys(originalPositionerStyles).length
  ) {
    return;
  }

  originalPositionerStyles = {
    top: positionerElement.style.top || '0',
    left: positionerElement.style.left || '0',
    right: positionerElement.style.right,
    height: positionerElement.style.height,
    bottom: positionerElement.style.bottom,
    minHeight: positionerElement.style.minHeight,
    maxHeight: positionerElement.style.maxHeight,
    marginTop: positionerElement.style.marginTop,
    marginBottom: positionerElement.style.marginBottom,
  };
}

function resetPlacementWhileClosed(positionerElement: HTMLElement | null) {
  if (open.value || alignItemWithTriggerActive.value) {
    return;
  }

  initialPlaced = false;
  reachedMaxHeight = false;
  clearStyles(positionerElement, originalPositionerStyles);
}

function placePopup(positionerElement: HTMLElement | null) {
  const popupElement = store.context.popupRef.value;
  const triggerElement = store.select('triggerElement');
  const listElement = store.select('listElement');
  const isAligned = alignItemWithTriggerActive.value;

  // Wait for Floating UI's first positioning pass before reading DOM geometry.
  // We replace the final coordinates for aligned selects, but still need middleware
  // like `size()` to set CSS variables such as `--anchor-width`.
  if (
    !open.value ||
    !triggerElement ||
    !positionerElement ||
    !popupElement ||
    (isAligned && !isPositioned.value) ||
    store.select('transitionStatus') === 'ending'
  ) {
    return;
  }

  initialPlaced = true;
  popupElement.style.removeProperty(SelectPositionerCssVars.transformOrigin);

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

    positionerElement.style.left = `${clamp(
      alignedLeft,
      paddingLeft,
      maxRight - positionerRect.width,
    )}px`;
    positionerElement.style.height = `${height}px`;
    // `none` (not the invalid `auto`) so the explicit height governs in align mode and isn't
    // clamped by a `max-height` from user CSS.
    positionerElement.style.maxHeight = 'none';
    positionerElement.style.marginTop = `${marginTop}px`;
    positionerElement.style.marginBottom = `${marginBottom}px`;
    popupElement.style.height = '100%';

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
      clearStyles(positionerElement, originalPositionerStyles);
      setControlledAlignItemWithTrigger(false);
      return;
    }

    const initialHeight = Math.max(minHeight, height);

    if (isTopPositioned) {
      const topOffset = Math.max(0, viewportHeight - idealHeight);
      positionerElement.style.top = positionerRect.height >= maxHeight ? '0' : `${topOffset}px`;
      positionerElement.style.height = `${height}px`;
      scroller.scrollTop = getMaxScrollTop(scroller);
    } else {
      positionerElement.style.bottom = '0';
      scroller.scrollTop = scrollTop;
    }

    if (textRect) {
      const popupTop = positionerRect.top;
      const popupHeight = positionerRect.height;
      const textCenterY = textRect.top + textRect.height / 2;

      const clampedY = clamp(
        popupHeight > 0 ? ((textCenterY - popupTop) / popupHeight) * 100 : 50,
        0,
        100,
      );

      popupElement.style.setProperty(SelectPositionerCssVars.transformOrigin, `50% ${clampedY}%`);
    }

    if (initialHeight === viewportHeight || height >= maxPopupHeight) {
      reachedMaxHeight = true;
    }

    store.context.handleScrollArrowVisibility(scroller);

    if (
      store.select('highlightItemOnHover') &&
      store.select('selectedIndex') === null &&
      store.select('activeIndex') === null &&
      store.context.listRef.value[0] != null
    ) {
      store.set('activeIndex', 0);
    }
  } finally {
    restoreTransformStyles();
  }
}

// The three effects of Base UI run in its sequence, after the DOM update of a change of any of
// their sources. Each source of the first two effects is also a source of the third.
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
  ],
  () => {
    const positionerElement = store.select('positionerElement');
    recordOriginalPositionerStyles(positionerElement);
    resetPlacementWhileClosed(positionerElement);
    placePopup(positionerElement);
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

let popupElement: HTMLElement | null = null;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [
    (popup) => {
      // A compiled template can mount a new popup before it unmounts the old one. The old one then
      // must not clear the element of the new one.
      if (popup !== null || store.context.popupRef.value === popupElement) {
        store.context.popupRef.value = popup;
        store.set('popupElement', popup);
      }
      popupElement = popup;
    },
  ],
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => {
    const hasList = store.select('listElement') !== null;
    const isAligned = alignItemWithTriggerActive.value;
    return [
      store.select('popupProps'),
      {
        ...listProps.value,
        onKeydown(event: KeyboardEvent) {
          // The arrow keys of the popup must not move the focus of a toolbar around the trigger.
          if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
        onScroll(event: Event) {
          if (store.select('listElement')) {
            return;
          }
          handleScroll(event.currentTarget as HTMLDivElement);
        },
        style: isAligned ? (hasList ? { height: '100%' } : LIST_FUNCTIONAL_STYLES) : undefined,
        class: !hasList && isAligned ? styleDisableScrollbar.className : undefined,
      },
      getDisabledMountTransitionStyles(transitionStatus.value),
      attrs,
    ];
  },
});

// `StyleDisableScrollbar` gives the server HTML its style element. A popup that is not in a portal
// is in the server HTML, and it hides its native scrollbar before the page hydrates.
useStyleDisableScrollbar(element);

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
  const originalStyles = {} as Record<TransformStyleProperty, string>;

  for (const [property, value] of TRANSFORM_STYLE_RESETS) {
    originalStyles[property] = style.getPropertyValue(property);
    style.setProperty(property, value, 'important');
  }

  return () => {
    for (const [property] of TRANSFORM_STYLE_RESETS) {
      const originalValue = originalStyles[property];
      if (originalValue) {
        style.setProperty(property, originalValue);
      } else {
        style.removeProperty(property);
      }
    }
  };
}
</script>

<template>
  <StyleDisableScrollbar />
  <FloatingFocusManager
    :store="store"
    :modal="false"
    :disabled="!mounted"
    :open-interaction-type="store.select('openMethod')"
    :return-focus="finalFocus"
    restore-focus
  >
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </FloatingFocusManager>
</template>
