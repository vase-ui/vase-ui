<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { TabsRootOrientation } from '../root/TabsRoot.vue';

export type TabsTabValue = any | null;

export type TabsTabActivationDirection = 'left' | 'right' | 'up' | 'down' | 'none';

export interface TabsTabPosition {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TabsTabSize {
  width: number;
  height: number;
}

export interface TabsTabMetadata {
  disabled: boolean;
  id: string | undefined;
  value: TabsTabValue | undefined;
}

export interface TabsTabState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component is active.
   */
  active: boolean;
  /**
   * The component orientation.
   */
  orientation: TabsRootOrientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTabActivationDirection;
}

export interface TabsTabProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<TabsTabState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled' | 'id'> {
  /**
   * The value of the Tab.
   */
  value: TabsTabValue;
  /**
   * Whether the Tab is disabled.
   *
   * If a first Tab on a `<Tabs.List>` is disabled, it won't initially be selected.
   * Instead, the next enabled Tab will be selected.
   * However, it does not work like this during server-side rendering, as it is not known
   * during pre-rendering which Tabs are disabled.
   * Give `defaultValue` or `modelValue` on `<Tabs.Root>` the value of an enabled tab.
   */
  disabled?: boolean | undefined;
  /**
   * The id of the tab. The panel of the tab uses it for `aria-labelledby`.
   * Without an id, the tab has a generated id.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, shallowRef, watchPostEffect, type ShallowRef } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { ownerDocument } from '../../common/owner';
import { useListenerSession } from '../../common/useListenerSession';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import {
  useCompositeItem,
  useCompositeRootContext,
} from '../../internals/composite/root/useCompositeRoot';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTabsListContext } from '../list/TabsListContext';
import { tabsStateAttributesMapping, useTabsRootContext } from '../root/TabsRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TabsTabProps>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Tabs.Tab');
}

defineSlots<{
  default(props: { state: TabsTabState }): unknown;
  render: ComponentRenderFn<HTMLProps, TabsTabState>;
}>();

const {
  value: activeTabValue,
  getTabPanelIdByValue,
  activeTabElement,
  onValueChange,
  registerTab,
  state: rootState,
} = useTabsRootContext();
const { activateOnFocus } = useTabsListContext();
const { hasFocus, highlightedIndex, onHighlightedIndexChange } = useCompositeRootContext();

// A panel registers its id in `setup`, and it can come after the tab.
useDeferredServerRender();

const tabId = useVaseUiId(() => props.id);
const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const active = computed(() => props.value === activeTabValue.value);
const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(() => props.disabled || (props.nativeButton && fieldsetDisabled.value));

useRegisteredId(
  () => tabId.value,
  (source, getId) => registerTab(source, getId && { value: () => props.value, id: getId }),
  () => element.value,
);

// A fieldset blocks interaction but keeps the selected panel. Only the prop selects a fallback.
const tabMetadata = computed<TabsTabMetadata>(() => ({
  disabled: props.disabled,
  id: tabId.value,
  value: props.value,
}));

const { attributes, events, index } = useCompositeItem<TabsTabMetadata>(element, {
  metadata: tabMetadata,
  active,
  // With no selection, no fallback runs. The first tab then keeps the tab stop after the mount, also
  // when it is disabled. The server HTML gives it the same tab stop.
  disabled: () => isDisabled.value && activeTabValue.value !== null,
});
// With duplicate values, only the first selected tab can claim the tab stop.
watchPostEffect(() => {
  if (
    !active.value ||
    isDisabled.value ||
    !element.value ||
    activeTabElement.value !== element.value
  ) {
    return;
  }
  const tabIndex = index.value;
  if (tabIndex >= 0 && tabIndex !== highlightedIndex.value && !hasFocus()) {
    onHighlightedIndexChange(tabIndex);
  }
});

const { isHeld } = useKeepAliveState();
const press = useListenerSession(isHeld);
let secondaryPress = false;

function activate(event: Event) {
  if (active.value || isDisabled.value) {
    return;
  }

  onValueChange(
    props.value,
    createChangeEventDetails(REASONS.none, event, undefined, {
      activationDirection: 'none' as const,
    }),
  );
}

function onFocusin(event: FocusEvent) {
  if (activateOnFocus.value && !secondaryPress) {
    activate(event);
  }
}

function onPointerdown(event: PointerEvent) {
  if (active.value || isDisabled.value) {
    return;
  }

  if (event.button === 0) {
    press.stop();
    return;
  }

  const doc = ownerDocument(event.currentTarget as Element);
  press.start((onCleanup, end) => {
    secondaryPress = true;
    onCleanup(() => {
      secondaryPress = false;
    });
    onCleanup(addEventListener(doc, 'pointerup', end));
    onCleanup(addEventListener(doc, 'pointercancel', end));
  });
}

const state = computed<TabsTabState>(() => ({
  ...rootState.value,
  disabled: isDisabled.value,
  active: active.value,
}));

const { elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  elementRef: element,
  button: (element) =>
    useButton(element, {
      disabled: isDisabled,
      native: () => props.nativeButton,
      focusableWhenDisabled: true,
    }),
  state,
  props: (attrs) => [
    attributes.value,
    events,
    {
      role: 'tab',
      'aria-controls': getTabPanelIdByValue(props.value),
      'aria-selected': active.value,
      id: tabId.value,
      onClick: activate,
      onFocusin,
      onPointerdown,
    },
    attrs,
  ],
  stateAttributesMapping: tabsStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
