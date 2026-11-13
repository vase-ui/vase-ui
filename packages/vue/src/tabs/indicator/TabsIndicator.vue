<script lang="ts">
import { getParentNode, isHTMLElement, isLastTraversableNode } from '@floating-ui/utils/dom';
import type { HTMLAttributes } from 'vue';
import { ownerWindow } from '../../common/owner';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import { getCssDimensions } from '../../utils/getCssDimensions';
import { getElementTransform } from '../../utils/getElementTransform';
import type { TabsRootOrientation, TabsRootState } from '../root/TabsRoot.vue';
import type { TabsTabPosition, TabsTabSize } from '../tab/TabsTab.vue';

export interface TabsIndicatorState extends TabsRootState {
  /**
   * The active tab position.
   */
  activeTabPosition: TabsTabPosition | null;
  /**
   * The active tab size.
   */
  activeTabSize: TabsTabSize | null;
  /**
   * The component orientation.
   */
  orientation: TabsRootOrientation;
}

export interface TabsIndicatorProps
  extends
    VaseUIComponentProps<TabsIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to render itself before Vue hydrates.
   * This minimizes the time that the indicator isn't visible after server-side rendering.
   * @default false
   */
  renderBeforeHydration?: boolean | undefined;
}

interface ActiveTabMeasurement {
  position: TabsTabPosition;
  size: TabsTabSize;
}

// `offsetLeft` and `offsetTop` are whole pixels. The error adds up along the chain of offset
// parents.
const MAX_LAYOUT_ROUNDING_ERROR = 2;

function measureActiveTab(
  activeTab: HTMLElement,
  tabsListElement: HTMLElement,
): ActiveTabMeasurement {
  const { width, height } = getCssDimensions(activeTab);
  const { width: tabsListWidth, height: tabsListHeight } = getCssDimensions(tabsListElement);
  const tabRect = activeTab.getBoundingClientRect();
  const tabsListRect = tabsListElement.getBoundingClientRect();
  const scaleX = tabsListWidth > 0 ? tabsListRect.width / tabsListWidth : 1;
  const scaleY = tabsListHeight > 0 ? tabsListRect.height / tabsListHeight : 1;

  // The layout offset ignores transforms, but it has no sub-pixel precision.
  let { left, top } = getLayoutOffset(activeTab, tabsListElement);

  const rectLeft =
    (tabRect.left - tabsListRect.left) / scaleX +
    tabsListElement.scrollLeft -
    tabsListElement.clientLeft;
  const rectTop =
    (tabRect.top - tabsListRect.top) / scaleY +
    tabsListElement.scrollTop -
    tabsListElement.clientTop;

  // The offset from the rect has sub-pixel precision, but it comes from the position in the
  // viewport. A rotation, a skew, a flip, a perspective or a 3D transform on the tab or on an
  // ancestor distorts it, and the division by the scale cannot undo that. When the two offsets are
  // equal up to the layout rounding, no distortion is in effect, and the offset from the rect is
  // safe to use.
  // A list that is scaled to zero gives `NaN` or `Infinity` above. That fails this same check, so
  // the layout offset stays and the scale needs no guard.
  // The own translation of the active tab moves the rect but not the layout offset, so the check
  // removes it. The indicator is a sibling of the tab and does not get its transform. It then
  // follows a tab that moves itself, such as `translateX(12px)` on the selected tab.
  const tabTranslation = getActiveTabTranslation(activeTab);
  if (
    Math.abs(rectLeft - tabTranslation.x - left) <= MAX_LAYOUT_ROUNDING_ERROR &&
    Math.abs(rectTop - tabTranslation.y - top) <= MAX_LAYOUT_ROUNDING_ERROR
  ) {
    left = rectLeft;
    top = rectTop;
  }

  return {
    position: {
      left,
      right: tabsListElement.scrollWidth - left - width,
      top,
      bottom: tabsListElement.scrollHeight - top - height,
    },
    size: { width, height },
  };
}

function getLayoutOffset(element: HTMLElement, ancestor: HTMLElement) {
  const elementOffset = getCumulativeOffset(element);
  const ancestorOffset = getCumulativeOffset(ancestor);

  let left = elementOffset.left - ancestorOffset.left - ancestor.clientLeft;
  let top = elementOffset.top - ancestorOffset.top - ancestor.clientTop;

  // The offsets describe the layout, and a scroll does not change the layout. A scroll container
  // between the tab and the list moves the tab on the screen, but not its layout slot. The loop
  // removes that scroll, so that this offset stays comparable with the offset from the rect.
  // Otherwise the difference looks like a distortion, and the indicator stays behind by the scroll.
  // The scroll of the list is not removed, because the indicator scrolls with the tab inside it.
  // `getParentNode` also crosses the boundary of a shadow root, so a tab in a shadow root reaches
  // the scroll containers between it and the list.
  let node: Node | null = getParentNode(element);
  while (isHTMLElement(node) && node !== ancestor && !isLastTraversableNode(node)) {
    left -= node.scrollLeft;
    top -= node.scrollTop;
    node = getParentNode(node);
  }

  return { left, top };
}

function getCumulativeOffset(element: HTMLElement) {
  let left = 0;
  let top = 0;
  let currentElement: HTMLElement | null = element;

  while (currentElement != null) {
    left += currentElement.offsetLeft;
    top += currentElement.offsetTop;

    const offsetParent = currentElement.offsetParent as HTMLElement | null;
    if (offsetParent != null) {
      left += offsetParent.clientLeft;
      top += offsetParent.clientTop;
    }

    currentElement = offsetParent;
  }

  return { left, top };
}

// Gives the 2D translation of the active tab in CSS pixels: the translation of the matrix in the
// computed `transform`, and the `translate` longhand. CSS applies `translate`, `rotate`, `scale`
// and `transform` in that order, so the sum is exact only with no rotation and no scale. That is
// enough here. With a rotation or a scale, the caller refuses the offset from the rect, whatever
// the translation is.
function getActiveTabTranslation(element: HTMLElement) {
  const computedStyle = ownerWindow(element).getComputedStyle(element);
  const { x, y } = getElementTransform(element, computedStyle);
  let translateX = x;
  let translateY = y;

  // The computed `transform` does not include the `translate` longhand. A computed value keeps a
  // percentage, which resolves against the border box of the tab.
  const { translate } = computedStyle;
  if (translate && translate !== 'none') {
    const parts = translate.split(' ');
    translateX += resolveTranslateLength(parts[0], element.offsetWidth);
    translateY += resolveTranslateLength(parts[1], element.offsetHeight);
  }

  return { x: translateX, y: translateY };
}

// Resolves one component of the `translate` longhand to pixels. A percentage resolves against the
// given size of the border box. A value that is not a number or a percentage, such as `calc(...)`,
// counts as no translation. The indicator then uses the layout offset and does not guess.
function resolveTranslateLength(value: string | undefined, referenceSize: number): number {
  if (!value) {
    return 0;
  }
  const numeric = parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return value.endsWith('%') ? (numeric / 100) * referenceSize : numeric;
}
</script>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, shallowRef } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import PrehydrationScript from '../../internals/PrehydrationScript.vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTabsListContext } from '../list/TabsListContext';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
import { script as prehydrationScript } from './prehydrationScript.min';
import * as TabsIndicatorCssVars from './TabsIndicatorCssVars';

defineOptions({ inheritAttrs: false });

const stateAttributesMapping: StateAttributesMapping<TabsIndicatorState> = {
  ...tabsStateAttributesMapping,
  activeTabPosition: () => null,
  activeTabSize: () => null,
};

const props = withDefaults(defineProps<TabsIndicatorProps>(), {
  as: 'span',
  renderBeforeHydration: false,
});

defineSlots<{
  default(props: { state: TabsIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, TabsIndicatorState>;
}>();

const { getTabElementBySelectedValue, orientation, tabActivationDirection, value } =
  useTabsRootContext();
const { tabsListElement, registerIndicatorUpdateListener } = useTabsListContext();

const isHydrating = useIsHydrating();

// The list calls the listener when its size or the size of a tab changes. The measurement reads the
// count, so each call measures again.
const updateCount = shallowRef(0);
let unregisterUpdateListener: (() => void) | undefined;

onMounted(() => {
  unregisterUpdateListener = registerIndicatorUpdateListener(() => {
    updateCount.value += 1;
  });
});

onScopeDispose(() => {
  unregisterUpdateListener?.();
});

const measurement = computed<ActiveTabMeasurement | null>(() => {
  void updateCount.value;
  // A change of the orientation can move a tab with no change of size, and the observer reports
  // only a change of size.
  void orientation.value;

  const listElement = tabsListElement.value;
  // The first client render must equal the server HTML, which has no measurement. A part that
  // hydrates after its list has the list element already.
  if (isHydrating.value || value.value == null || listElement === null) {
    return null;
  }

  const activeTab = getTabElementBySelectedValue(value.value);
  return activeTab === null ? null : measureActiveTab(activeTab, listElement);
});

const state = computed<TabsIndicatorState>(() => ({
  orientation: orientation.value,
  activeTabPosition: measurement.value?.position ?? null,
  activeTabSize: measurement.value?.size ?? null,
  tabActivationDirection: tabActivationDirection.value,
}));

// The template puts `PrehydrationScript` directly after the element. The script finds the indicator
// as `document.currentScript.previousElementSibling`.
const { element, elementProps } = useRenderElement('span', props, {
  state,
  props: (attrs) => {
    const measured = measurement.value;
    // Do not display the indicator before the layout is settled.
    const isDisplayed = measured !== null && measured.size.width > 0 && measured.size.height > 0;

    return [
      {
        role: 'presentation',
        style: measured
          ? {
              [TabsIndicatorCssVars.activeTabLeft]: `${measured.position.left}px`,
              [TabsIndicatorCssVars.activeTabRight]: `${measured.position.right}px`,
              [TabsIndicatorCssVars.activeTabTop]: `${measured.position.top}px`,
              [TabsIndicatorCssVars.activeTabBottom]: `${measured.position.bottom}px`,
              [TabsIndicatorCssVars.activeTabWidth]: `${measured.size.width}px`,
              [TabsIndicatorCssVars.activeTabHeight]: `${measured.size.height}px`,
            }
          : undefined,
        // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
        hidden: isDisplayed ? undefined : true,
        // The script of the server HTML removes `hidden` and writes the style. Vue compares the
        // style only when the client render has a `style` key, such as the style of a consumer.
        'data-allow-mismatch':
          props.renderBeforeHydration && isHydrating.value ? 'style,attribute' : undefined,
      },
      attrs,
    ];
  },
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <template v-if="value != null">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
    <PrehydrationScript v-if="renderBeforeHydration" :script="prehydrationScript" />
  </template>
</template>
