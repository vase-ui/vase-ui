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
   * To work around it, ensure that `defaultValue` or `value` on `<Tabs.Root>` is set to an enabled Tab's value.
   */
  disabled?: boolean | undefined;
  /**
   * The id of the tab. The panel of the tab uses it for `aria-labelledby`.
   * A server render writes the tab before it renders a panel that comes after it. The tab then
   * has no `aria-controls` in the server HTML, and it gets it in the first flush on the client.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTabsListContext } from '../list/TabsListContext';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TabsTabProps>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
});

defineSlots<{
  default(props: { state: TabsTabState }): unknown;
  render: ComponentRenderFn<HTMLProps, TabsTabState>;
}>();

const {
  value: activeTabValue,
  getTabPanelIdByValue,
  onValueChange,
  orientation,
  registerTab,
  tabActivationDirection,
} = useTabsRootContext();
const { activateOnFocus, registerTabResizeObserverElement, tabsListElement } = useTabsListContext();
const { highlightedIndex, onHighlightedIndexChange } = useCompositeRootContext();

const tabId = useVaseUiId(() => props.id);
const active = computed(() => props.value === activeTabValue.value);

const registrationSource = Symbol();
useRegisteredId(
  () => tabId.value,
  (getId) => registerTab(registrationSource, getId && { value: () => props.value, id: getId }),
);

const tabMetadata = computed<TabsTabMetadata>(() => ({
  disabled: props.disabled,
  id: tabId.value,
  value: props.value,
}));

const { compositeProps, compositeRef, index } = useCompositeItem<TabsTabMetadata>({
  metadata: tabMetadata,
  active,
  disabled: () => props.disabled,
});

const { getButtonProps, buttonRef } = useButton({
  disabled: () => props.disabled,
  native: () => props.nativeButton,
  focusableWhenDisabled: true,
});

let unobserveTabElement: (() => void) | null = null;

// The ref callback and not an effect: the observer follows the element when `as` or the `#render`
// slot changes the element.
function observeTabElement(element: HTMLElement | null) {
  unobserveTabElement?.();
  unobserveTabElement = element ? registerTabResizeObserverElement(element) : null;
}

let isNavigating = false;

// Keeps the highlighted item in sync with the active tab when the value changes outside the list.
function syncHighlight() {
  if (isNavigating) {
    isNavigating = false;
    return;
  }

  if (!(active.value && index.value > -1 && highlightedIndex.value !== index.value)) {
    return;
  }

  // While focus is inside the list, the highlight follows the focus. The keys continue from the
  // focused tab after a change of the value outside the list.
  const listElement = tabsListElement.value;
  if (listElement !== null) {
    const focusedElement = activeElement(ownerDocument(listElement));
    if (focusedElement && contains(listElement, focusedElement)) {
      return;
    }
  }

  // A disabled tab can get focus but must not take the tab stop by a change of the value outside.
  if (!props.disabled) {
    onHighlightedIndexChange(index.value);
  }
}

onMounted(syncHighlight);
watch([active, index, highlightedIndex, () => props.disabled, tabsListElement], syncHighlight, {
  flush: 'post',
});

let isPressing = false;
let isMainButton = false;

// Both callers return when the tab is active, so the current value is never committed again.
function activate(event: Event) {
  onValueChange(
    props.value,
    createChangeEventDetails(REASONS.none, event, undefined, {
      activationDirection: 'none' as const,
    }),
  );
}

function onClick(event: MouseEvent) {
  if (active.value || props.disabled) {
    return;
  }

  activate(event);
}

function onFocusin(event: FocusEvent) {
  if (active.value || props.disabled) {
    return;
  }

  if (
    activateOnFocus.value &&
    (!isPressing || // keyboard or touch focus
      isMainButton) // main mouse button focus
  ) {
    activate(event);
  }
}

function onPointerdown(event: PointerEvent) {
  if (active.value || props.disabled) {
    return;
  }

  isPressing = true;
  // A secondary press (context menu, middle button) can focus the tab, but it must not activate
  // the tab with `activateOnFocus`.
  isMainButton = event.button === 0;

  // The listeners are set for each button. A secondary press then does not leave the tab in the
  // pressed state, which would stop the activation on a later focus.
  const doc = ownerDocument(event.currentTarget as Element);

  function handlePointerEnd() {
    isPressing = false;
    isMainButton = false;
    doc.removeEventListener('pointerup', handlePointerEnd);
    doc.removeEventListener('pointercancel', handlePointerEnd);
  }

  doc.addEventListener('pointerup', handlePointerEnd);
  doc.addEventListener('pointercancel', handlePointerEnd);
}

const state = computed<TabsTabState>(() => ({
  disabled: props.disabled,
  active: active.value,
  orientation: orientation.value,
  tabActivationDirection: tabActivationDirection.value,
}));

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [compositeRef, buttonRef, observeTabElement],
  props: (attrs) => [
    compositeProps.value,
    {
      role: 'tab',
      'aria-controls': getTabPanelIdByValue(props.value),
      'aria-selected': active.value,
      id: tabId.value,
      onClick,
      onFocusin,
      onPointerdown,
      [ACTIVE_COMPOSITE_ITEM]: active.value ? '' : undefined,
      onKeydownCapture() {
        isNavigating = true;
      },
    },
    attrs,
    getButtonProps,
  ],
  stateAttributesMapping: tabsStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
