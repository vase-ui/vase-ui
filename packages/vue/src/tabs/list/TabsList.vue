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
import { computed, provide, shallowRef } from 'vue';
import { EMPTY_ARRAY } from '../../common/empty';
import { useResizeObserver } from '../../common/useResizeObserver';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { tabsStateAttributesMapping, useTabsRootContext } from '../root/TabsRootContext';
import type { TabsTabMetadata } from '../tab/TabsTab.vue';
import { TabsListContext } from './TabsListContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TabsListProps>(), {
  as: 'div',
  activateOnFocus: false,
  loopFocus: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Tabs.List');
}

defineSlots<{
  default(props: { state: TabsListState }): unknown;
  render: ComponentRenderFn<HTMLProps, TabsListState>;
}>();

const { hasChosenTab, setTabMap, state } = useTabsRootContext();

// A selected tab can be hidden or natively disabled and still own the tab stop.
const highlightedTabIndex = shallowRef(0);

const { elementsRef, onFocusin, onFocusout, onKeydown, registerRoot } =
  useCompositeRoot<TabsTabMetadata>({
    highlightedIndex: highlightedTabIndex,
    enableHomeAndEndKeys: true,
    loopFocus: () => props.loopFocus,
    orientation: () => state.value.orientation,
    onHighlightedIndexChange(index) {
      highlightedTabIndex.value = index;
    },
    onMapChange: setTabMap,
    // A disabled tab can get focus, so the keys do not skip it.
    getDisabledIndices: () => EMPTY_ARRAY,
    hasActiveItem: hasChosenTab,
  });

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: registerRoot,
  props: (attrs) => [
    { onFocusin, onFocusout, onKeydown },
    {
      'aria-orientation': state.value.orientation === 'vertical' ? 'vertical' : undefined,
      role: 'tablist',
    },
    attrs,
  ],
  stateAttributesMapping: tabsStateAttributesMapping,
});

const resizeCount = shallowRef(0);
useResizeObserver(
  () => element.value && [element.value, ...elementsRef.value],
  () => {
    resizeCount.value += 1;
  },
);

provide(TabsListContext, {
  activateOnFocus: computed(() => props.activateOnFocus),
  resizeCount,
  tabElements: elementsRef,
  tabsListElement: element,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
