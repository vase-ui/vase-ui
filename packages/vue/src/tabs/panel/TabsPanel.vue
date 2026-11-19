<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { TabsRootState } from '../root/TabsRoot.vue';
import type { TabsTabValue } from '../tab/TabsTab.vue';

export interface TabsPanelMetadata {
  id?: string | undefined;
  value: TabsTabValue;
}

export interface TabsPanelState extends TabsRootState {
  /**
   * Whether the component is hidden.
   */
  hidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface TabsPanelProps
  extends
    VaseUIComponentProps<TabsPanelState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The value of the TabPanel. It will be shown when the Tab with the corresponding value is active.
   */
  value: TabsTabValue;
  /**
   * Whether to keep the HTML element in the DOM while the panel is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * The id of the panel. The tab of the panel uses it for `aria-controls`.
   * Without an id, the panel has a generated id.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, shallowRef, type ShallowRef } from 'vue';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeList';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { tabsStateAttributesMapping, useTabsRootContext } from '../root/TabsRootContext';
import * as TabsPanelDataAttributes from './TabsPanelDataAttributes';

defineOptions({ inheritAttrs: false });

const stateAttributesMapping: StateAttributesMapping<TabsPanelState> = {
  ...tabsStateAttributesMapping,
  ...transitionStatusMapping,
};

const props = withDefaults(defineProps<TabsPanelProps>(), {
  as: 'div',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: TabsPanelState }): unknown;
  render: ComponentRenderFn<HTMLProps, TabsPanelState>;
}>();

const {
  value: selectedValue,
  getTabIdByPanelValue,
  panelList,
  registerPanel,
  state: rootState,
} = useTabsRootContext();

// A tab registers its id in `setup`, and it can come after the panel.
useDeferredServerRender();

const panelId = useVaseUiId(() => props.id);
const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const open = computed(() => props.value === selectedValue.value);
const { mounted, transitionStatus, setMounted } = useTransitionStatus(
  open,
  false,
  false,
  false,
  () => element.value,
);
const hidden = computed(() => !mounted.value);

// The tab names a panel that is in the document. A hidden panel with no `keepMounted` has no element.
useRegisteredId(
  () => (hidden.value && !props.keepMounted ? undefined : panelId.value),
  (source, getId) => registerPanel(source, getId && { value: () => props.value, id: getId }),
  () => element.value,
);

const index = useCompositeListItem(element, { list: panelList });

const state = computed<TabsPanelState>(() => ({
  ...rootState.value,
  hidden: hidden.value,
  transitionStatus: transitionStatus.value,
}));

const { elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  elementRef: element,
  state,
  props: (attrs) => [
    {
      'aria-labelledby': getTabIdByPanelValue(props.value),
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: hidden.value ? true : undefined,
      id: panelId.value,
      role: 'tabpanel',
      tabindex: open.value ? 0 : -1,
      inert: open.value ? undefined : true,
      [TabsPanelDataAttributes.index]: index.value,
    },
    attrs,
  ],
  stateAttributesMapping,
});

useOpenChangeComplete({
  open,
  ref: element,
  onComplete() {
    if (!open.value) {
      setMounted(false);
    }
  },
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="(keepMounted || mounted) && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component :is="as" v-else-if="keepMounted || mounted" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
