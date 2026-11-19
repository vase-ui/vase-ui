<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  NonNativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface MenuSubmenuTriggerState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
}

export interface MenuSubmenuTriggerProps
  extends
    NonNativeButtonProps,
    VaseUIComponentProps<MenuSubmenuTriggerState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {
  /**
   * Overrides the text used for keyboard text navigation and filtering.
   * Falls back to the rendered text when not provided.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * How long to wait before the menu may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the menu that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * Whether the menu should also open when the trigger is hovered.
   * @default true
   */
  openOnHover?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { triggerBindings } from '../../utils/popups/popupBindings';
import { bindPositionerHandlers, submenuTriggers } from '../../utils/popups/registeredParts';
import { useElementRegistration } from '../../internals/useElementRegistration';
import { computed, onMounted, onUpdated, shallowRef, watch, type ShallowRef } from 'vue';
import { isElementDisabled } from '../../common/isElementDisabled';
import { platform } from '../../common/platform';
import { getTarget } from '../../common/shadowDom';
import { warn } from '../../common/warn';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeList';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTriggerPress, useTriggerRegistration } from '../../utils/popups/usePopupTrigger';
import { useHoverPointerStyle, usePopupHover } from '../../utils/popups/interactions/usePopupHover';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useDomEffect } from '../../utils/popups/useDomEffect';
import { useMenuFilterItem } from '../filter-root/MenuFilterContext';
import { useMenuItem } from '../item/useMenuItem';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuSubmenuTriggerProps>(), {
  as: 'div',
  nativeButton: false,
  disabled: false,
  delay: 100,
  closeDelay: 0,
  openOnHover: true,
});

defineSlots<{
  default(props: { state: MenuSubmenuTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuSubmenuTriggerState>;
}>();

const context = useMenuRootContext(true);
if (context?.parent.type !== 'menu') {
  throw new Error(
    'Vase UI: <Menu.SubmenuTrigger> must be inside <Menu.SubmenuRoot>. Without a submenu root the trigger has no submenu to open. Put the trigger inside <Menu.SubmenuRoot>.',
  );
}

const { store, parentVirtualFocus } = context;
const parentMenuStore = context.parent.store;
const submenuRootContext = useMenuSubmenuRootContext();

// The trigger is an item of the list of the parent menu. A filterable parent removes its element
// while the query hides it. The template then gives its content to a component that reads the text
// and adds no element to the document.
const filterItem = useMenuFilterItem({ label: () => props.label }, 'submenu-trigger');
const thisTriggerId = useVaseUiId(() => props.id);

const open = computed(() => store.select('open'));
const floatingTreeRoot = computed(() => store.select('floatingTreeRoot'));
const popupId = computed(() => store.select('triggerPopupId', thisTriggerId.value));

// Base UI also writes the active trigger to the store when the part registers. For an open submenu,
// `useImplicitActiveTrigger` does this work.
const { registerTrigger } = useTriggerRegistration(thisTriggerId, store);

const triggerElement: ShallowRef<HTMLElement | null> = shallowRef(null);

let focusReturnedThroughGuard = false;

// The listener sees the focus leave the guard in the positioner. When the portal is in a shadow
// root, the focus event of the trigger can report the shadow host as `relatedTarget`, not the guard.
useDomEffect([open, () => store.select('positionerElement')], () => {
  const positionerElement = store.select('positionerElement');
  if (!open.value || !positionerElement) {
    return undefined;
  }

  function handleGuardFocusOut(event: FocusEvent) {
    if (getTarget(event) === store.context.beforeContentFocusGuardRef.value) {
      focusReturnedThroughGuard = event.relatedTarget === triggerElement.value;
    }
  }

  const detach = bindPositionerHandlers(positionerElement, {
    onFocusoutCapture: handleGuardFocusOut,
  });
  return () => {
    focusReturnedThroughGuard = false;
    detach?.();
  };
});

watch(
  () => props.closeDelay,
  (closeDelay) => store.set('closeDelay', closeDelay),
  { immediate: true },
);

const isDisabled = computed(
  () => props.disabled || store.select('disabled') || parentMenuStore.select('disabled'),
);

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Menu.SubmenuTrigger');
  const warnForDisabledElement = () => {
    const element = triggerElement.value;
    if (element && isElementDisabled(element) && !isDisabled.value) {
      warn(
        'A disabled element was detected on <Menu.SubmenuTrigger>. To properly disable the trigger, use the `disabled` prop on the component instead of setting it on the rendered element.',
      );
    }
  };
  onMounted(warnForDisabledElement);
  onUpdated(warnForDisabledElement);
}

const listIndex = useCompositeListItem(triggerElement, { label: () => props.label });

const highlighted = computed(() => parentMenuStore.select('isActive', listIndex.value));

function onMouseenter(event: MouseEvent) {
  if (parentMenuStore.select('highlightItemOnHover')) {
    parentMenuStore.setActiveIndex(listIndex.value, REASONS.pointer, event);
  }
}

const { button, commonProps } = useMenuItem(triggerElement, {
  closeOnClick: false,
  disabled: isDisabled,
  highlighted,
  id: thisTriggerId,
  store,
  typingRef: parentMenuStore.context.typingRef,
  nativeButton: () => props.nativeButton,
  isSubmenuTrigger: true,
});

const hoverStyle = useHoverPointerStyle(triggerElement);
const hoverProps = usePopupHover(store).trigger({
  enabled: () => store.select('hoverEnabled') && props.openOnHover && !isDisabled.value,
  safePolygon: { blockPointerEvents: true },
  mouseOnly: true,
  move: true,
  restMs: () => props.delay,
  delay: () => ({ open: props.delay, close: props.closeDelay }),
  shouldOpen: () => props.delay <= 0 || parentMenuStore.select('allowMouseEnter'),
  triggerElement,
  externalTree: floatingTreeRoot,
  // Chrome can drop the trigger's `mouseleave` during a fast pointer sweep, leaving a stale
  // submenu open (https://github.com/mui/base-ui/issues/5152), so cancel from `mouseout` too.
  guardStaleOpen: true,
});

const click = useTriggerPress(store, {
  enabled: () => !isDisabled.value,
  event: 'mousedown',
  // Without toggling, TalkBack users cannot close the submenu to reach the next parent menu
  // item: moving the virtual cursor outside does not close it, and moving forward again
  // re-enters the still-open submenu. Keep toggling enabled so activating its trigger closes it.
  // Toggling applies to touch and keyboard activation. In hover mode, mouse presses are
  // ignored and the first activation after hover-opening keeps the submenu open.
  toggle: true,
  ignoreMouse: () => props.openOnHover,
  stickIfOpen: () => props.openOnHover,
});

const rootTriggerProps = computed(() => triggerBindings(store, true));

// Arrow keys open the submenu through list navigation without dispatching a click, so
// `openMethod` stays null there; Enter and Space do dispatch one and report `keyboard`.
const shouldOmitExpanded = computed(
  () =>
    open.value &&
    (store.select('lastOpenChangeReason') === REASONS.listNavigation ||
      store.select('openMethod') === 'keyboard') &&
    platform.screenReader.voiceOver,
);

const state = computed<MenuSubmenuTriggerState>(() => ({
  disabled: isDisabled.value,
  highlighted: highlighted.value,
  open: open.value,
}));

const ownProps = {
  onFocusin(event: FocusEvent) {
    // Close when the focus returns through the guard of the submenu to its trigger. This also lets
    // screen reader users move past the trigger in the parent menu. Direct focus from a submenu
    // item, such as on hover, leaves the submenu open.
    if (store.select('open') && focusReturnedThroughGuard) {
      focusReturnedThroughGuard = false;
      store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));
    }
  },
  onFocusout() {
    if (highlighted.value) {
      parentMenuStore.setActiveIndex(null, REASONS.none);
    }
  },
};

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  elementRef: triggerElement,
  button,
  state,
  stateAttributesMapping: triggerOpenStateMapping,
  ref: [registerTrigger, filterItem.ref],
  props: (attrs) => [
    commonProps.value,
    { onMouseenter },
    click,
    hoverProps,
    { style: hoverStyle.value },
    rootTriggerProps.value,
    // The filterable submenu root replaces the key handler of the generic trigger, because the
    // keys that enter and leave the submenu depend on the orientations of both menus.
    submenuRootContext?.onTriggerKeydown
      ? { onKeydown: submenuRootContext.onTriggerKeydown }
      : undefined,
    parentMenuStore.select('itemProps'),
    // Opening a submenu changes the trigger's expanded state while the trigger still holds
    // focus, and VoiceOver announces that state change instead of the submenu item that focus
    // moves to a moment later, so the first item is never announced. Dropping the state while
    // the submenu is open avoids the announcement without claiming the submenu is collapsed;
    // `aria-haspopup` still conveys that the item opens a submenu.
    shouldOmitExpanded.value ? { 'aria-expanded': undefined } : undefined,
    {
      'aria-controls': popupId.value,
      // A virtually focused parent keeps real focus on its input, so the trigger must stay out
      // of the tab order.
      tabindex: parentVirtualFocus || !(open.value || highlighted.value) ? -1 : 0,
    },
    ownProps,
    filterItem.props,
    attrs,
  ],
});

useElementRegistration(submenuTriggers, element, () => true);

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="filterItem.visible.value && usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="filterItem.visible.value" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <component :is="filterItem.HiddenItemText" v-else :set-text="filterItem.setHiddenText" :label="label">
    <slot v-if="$slots.render" name="render" :props="{} as HTMLProps" :state="state" />
    <slot v-else :state="state" />
  </component>
</template>
