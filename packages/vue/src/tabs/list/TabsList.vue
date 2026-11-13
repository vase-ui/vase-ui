<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TabsRootState } from '../root/TabsRoot.vue';

export interface TabsListState extends TabsRootState {}

export interface TabsListProps
  extends VaseUIComponentProps<TabsListState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether to automatically change the active tab on arrow key focus.
   * Otherwise, tabs will be activated using <kbd>Enter</kbd> or <kbd>Space</kbd> key press.
   * @default false
   */
  activateOnFocus?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, provide, shallowRef, watch } from 'vue';
import { EMPTY_ARRAY } from '../../common/empty';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
import type { TabsTabMetadata } from '../tab/TabsTab.vue';
import { TabsListContext } from './TabsListContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TabsListProps>(), {
  as: 'div',
  activateOnFocus: false,
  loopFocus: true,
});

defineSlots<{
  default(props: { state: TabsListState }): unknown;
  render: ComponentRenderFn<HTMLProps, TabsListState>;
}>();

const { hasChosenTab, orientation, setTabMap, tabActivationDirection } = useTabsRootContext();

// The list controls the index, as Base UI does. The composite then does not move the tab stop off a
// disabled tab. Without this, the composite moves the tab stop off a selected tab that is hidden or
// natively disabled. The tab moves it back. The two moves repeat.
const highlightedTabIndex = shallowRef(0);

const { props: compositeProps, rootRef } = useCompositeRoot<TabsTabMetadata>({
  highlightedIndex: highlightedTabIndex,
  enableHomeAndEndKeys: true,
  loopFocus: () => props.loopFocus,
  orientation,
  onHighlightedIndexChange(index) {
    highlightedTabIndex.value = index;
  },
  onMapChange: setTabMap,
  // A disabled tab can get focus, so the keys do not skip it.
  disabledIndices: EMPTY_ARRAY,
  hasActiveItem: hasChosenTab,
});

const state = computed<TabsListState>(() => ({
  orientation: orientation.value,
  tabActivationDirection: tabActivationDirection.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [rootRef],
  props: (attrs) => [
    compositeProps,
    {
      'aria-orientation': orientation.value === 'vertical' ? 'vertical' : undefined,
      role: 'tablist',
    },
    attrs,
  ],
  stateAttributesMapping: tabsStateAttributesMapping,
});

const indicatorUpdateListeners = new Set<() => void>();
const tabResizeObserverElements = new Set<HTMLElement>();
let resizeObserver: ResizeObserver | null = null;

// `KeepAlive` takes the elements out of the document. They have no layout there, so the observer
// stops until the list is active again.
const isDeactivated = shallowRef(false);

onDeactivated(() => {
  isDeactivated.value = true;
});

onActivated(() => {
  isDeactivated.value = false;
});

watch(
  [element, isDeactivated],
  ([listElement, deactivated], _previous, onCleanup) => {
    if (listElement === null || deactivated || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      indicatorUpdateListeners.forEach((listener) => listener());
    });
    resizeObserver = observer;
    observer.observe(listElement);
    tabResizeObserverElements.forEach((tabElement) => observer.observe(tabElement));

    onCleanup(() => {
      observer.disconnect();
      resizeObserver = null;
    });
  },
  { flush: 'post' },
);

provide(TabsListContext, {
  activateOnFocus: computed(() => props.activateOnFocus),
  registerIndicatorUpdateListener(listener) {
    indicatorUpdateListeners.add(listener);
    return () => {
      indicatorUpdateListeners.delete(listener);
    };
  },
  registerTabResizeObserverElement(tabElement) {
    tabResizeObserverElements.add(tabElement);
    resizeObserver?.observe(tabElement);
    return () => {
      tabResizeObserverElements.delete(tabElement);
      resizeObserver?.unobserve(tabElement);
    };
  },
  tabsListElement: element,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
