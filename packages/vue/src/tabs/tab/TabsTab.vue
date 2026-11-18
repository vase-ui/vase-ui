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
   * Without an id, the tab has a generated id.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
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
  onValueChange,
  orientation,
  registerTab,
  tabActivationDirection,
} = useTabsRootContext();
const { activateOnFocus, registerTabResizeObserverElement, tabsListElement } = useTabsListContext();
const { highlightedIndex, onHighlightedIndexChange } = useCompositeRootContext();

// A panel registers its id in `setup`, and it can come after the tab.
useDeferredServerRender();

const tabId = useVaseUiId(() => props.id);
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

const { compositeProps, compositeRef, index } = useCompositeItem<TabsTabMetadata>({
  metadata: tabMetadata,
  active,
  // With no selection, no fallback runs. The first tab then keeps the tab stop after the mount, also
  // when it is disabled. The server HTML gives it the same tab stop.
  disabled: () => isDisabled.value && activeTabValue.value !== null,
});

const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
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

  // A tab disabled by its prop can get focus. No disabled tab takes the tab stop from an external
  // value change.
  if (!isDisabled.value) {
    onHighlightedIndexChange(index.value);
  }
}

onMounted(syncHighlight);
watch([active, index, highlightedIndex, isDisabled, tabsListElement], syncHighlight, {
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
  if (active.value || isDisabled.value) {
    return;
  }

  activate(event);
}

function onFocusin(event: FocusEvent) {
  if (active.value || isDisabled.value) {
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
  if (active.value || isDisabled.value) {
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
  disabled: isDisabled.value,
  active: active.value,
  orientation: orientation.value,
  tabActivationDirection: tabActivationDirection.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
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
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
