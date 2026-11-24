<script setup lang="ts">
import { computed, mergeProps, onMounted, provide, shallowRef, useAttrs, watch } from 'vue';
import { byDocumentOrder, useElement, type ElementSlotProps } from '../common/element';
import { ownerWindow } from '../common/owner';
import { tabsListKey } from './list';
import { injectTabsRoot, type RootTab } from './root';
import type { TabsListProps, TabsListState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TabsListProps>(), {
  activateOnFocus: false,
  loopFocus: true,
});
defineSlots<{
  default?(scope: { state: TabsListState }): unknown;
  element?(scope: ElementSlotProps<TabsListState>): unknown;
}>();

const root = injectTabsRoot();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();
// The tab that has the focus. Firefox and WebKit send no `blur` when Vue removes the focused
// element, so a tab counts only while it is mounted.
const focused = shallowRef<RootTab>();
const tabStop = computed(() =>
  focused.value && root.tabs.includes(focused.value) ? focused.value : root.tabStop,
);
// The last key that the list handled. The list stops it, so an ancestor with keys of its own does
// not also act on it.
let handledKey: KeyboardEvent | undefined;

provide(tabsListKey, {
  get element() {
    return element.value;
  },
  get tabStop() {
    return tabStop.value;
  },
  onKeydown,
  onFocus(tab) {
    focused.value = tab;
  },
  onBlur() {
    focused.value = undefined;
  },
});

// The platform shows no active tab by itself. `scrollIntoView()` would also scroll the page.
onMounted(() => {
  if (root.tabs.length > 0) showActiveTab();
  else watch(() => root.tabs.length > 0, showActiveTab, { once: true, flush: 'post' });
});

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      role: 'tablist',
      'aria-orientation': root.state.orientation === 'vertical' ? 'vertical' : undefined,
      'data-activation-direction': root.state.tabActivationDirection,
      onKeydown: stopHandledKey,
    },
    attrs,
  );
}

function stopHandledKey(event: KeyboardEvent) {
  if (event === handledKey) event.stopPropagation();
}

type Step = 'first' | 'last' | 'next' | 'previous';

const steps: Record<string, Record<string, Step | 'right' | 'left'>> = {
  horizontal: { Home: 'first', End: 'last', ArrowRight: 'right', ArrowLeft: 'left' },
  vertical: { Home: 'first', End: 'last', ArrowDown: 'next', ArrowUp: 'previous' },
};

function onKeydown(event: KeyboardEvent, from: RootTab) {
  const list = element.value;
  const key = steps[root.state.orientation]?.[event.key];
  if (!key || !list || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  handledKey = event;
  const rtl = ownerWindow(list).getComputedStyle(list).direction === 'rtl';
  const step =
    key === 'right' || key === 'left' ? ((key === 'right') !== rtl ? 'next' : 'previous') : key;
  const elements = root.tabs
    .flatMap((tab) => (tab.element ? [tab.element] : []))
    .sort(byDocumentOrder);
  const focusedTab = focusFirstOf(candidates(elements, from.element, step));
  // The scroll of `focus()` differs in each browser and can leave the tab cut
  // (test/measurements/tabs.test.ts).
  focusedTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const tab = root.tabs.find((candidate) => candidate.element === focusedTab);
  if (tab && !tab.disabled && props.activateOnFocus) root.select(tab.value, event);
}

// The tabs that can take the focus, in the order in which the key asks for them.
function candidates(elements: HTMLElement[], from: HTMLElement | null, step: Step) {
  if (step === 'first') return elements;
  if (step === 'last') return [...elements].reverse();
  const index = from ? elements.indexOf(from) : -1;
  const forward = step === 'next';
  const after = forward ? elements.slice(index + 1) : elements.slice(0, index).reverse();
  if (!props.loopFocus) return after;
  const before = forward ? elements.slice(0, index) : elements.slice(index + 1).reverse();
  return [...after, ...before];
}

// The browser decides which tab can take the focus: it refuses a tab that it disables or does not
// render.
function focusFirstOf(elements: HTMLElement[]) {
  return elements.find((candidate) => {
    candidate.focus({ preventScroll: true });
    const rootNode = candidate.getRootNode();
    return 'activeElement' in rootNode && rootNode.activeElement === candidate;
  });
}

// The scroll of `scrollIntoView` with 'nearest' for a tab that fits in the list, on the list only: it
// reads the `scroll-padding` of the list and the `scroll-margin` of the tab
// (test/measurements/tabs.test.ts).
function showActiveTab() {
  const list = element.value;
  const tab = root.activeTab?.element;
  if (!list || !tab) return;
  const vertical = root.state.orientation === 'vertical';
  const window = ownerWindow(list);
  const listStyle = window.getComputedStyle(list);
  const tabStyle = window.getComputedStyle(tab);
  const listRect = list.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  const length = (text: string) => Number.parseFloat(text) || 0;
  if (vertical) {
    const viewStart = listRect.top + list.clientTop + length(listStyle.scrollPaddingTop);
    const viewEnd =
      listRect.top + list.clientTop + list.clientHeight - length(listStyle.scrollPaddingBottom);
    list.scrollTop += distance(
      tabRect.top - length(tabStyle.scrollMarginTop) - viewStart,
      tabRect.bottom + length(tabStyle.scrollMarginBottom) - viewEnd,
    );
  } else {
    const viewStart = listRect.left + list.clientLeft + length(listStyle.scrollPaddingLeft);
    const viewEnd =
      listRect.left + list.clientLeft + list.clientWidth - length(listStyle.scrollPaddingRight);
    list.scrollLeft += distance(
      tabRect.left - length(tabStyle.scrollMarginLeft) - viewStart,
      tabRect.right + length(tabStyle.scrollMarginRight) - viewEnd,
    );
  }
}

// The least scroll that shows the start of the tab, and its end when the view is long enough.
function distance(startOverflow: number, endOverflow: number) {
  if (startOverflow < 0) return startOverflow;
  if (endOverflow > 0) return Math.min(startOverflow, endOverflow);
  return 0;
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="root.state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </div>
</template>
