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
   * A server render writes the panel before it renders a tab that comes after it. The panel then
   * has no `aria-labelledby` in the server HTML, and it gets it in the first flush on the client.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
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
  orientation,
  registerPanel,
  tabActivationDirection,
} = useTabsRootContext();

const panelId = useVaseUiId(() => props.id);

const { ref: listItemRef, index } = useCompositeListItem();

const open = computed(() => props.value === selectedValue.value);
// The getter for `element` runs after `setup`, so the later declaration of `element` is in scope.
const { mounted, transitionStatus, setMounted } = useTransitionStatus(
  open,
  false,
  false,
  false,
  () => element.value,
);
const hidden = computed(() => !mounted.value);

// The tab names a panel that is in the document. A hidden panel with no `keepMounted` has no element.
const registrationSource = Symbol();
useRegisteredId(
  () => (hidden.value && !props.keepMounted ? undefined : panelId.value),
  (getId) => registerPanel(registrationSource, getId && { value: () => props.value, id: getId }),
);

const state = computed<TabsPanelState>(() => ({
  hidden: hidden.value,
  orientation: orientation.value,
  tabActivationDirection: tabActivationDirection.value,
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [listItemRef],
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
  <template v-if="keepMounted || mounted">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
</template>
