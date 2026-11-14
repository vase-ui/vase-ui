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
import { computed, onMounted, onUpdated, shallowRef, watch } from 'vue';
import { isElementDisabled } from '../../common/isElementDisabled';
import { platform } from '../../common/platform';
import { warn } from '../../common/warn';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useTriggerRegistration } from '../../utils/popups/popupStoreUtils';
import { useMenuItem } from '../item/useMenuItem';
import type { UseMenuItemMetadata } from '../item/useMenuItem';
import { useMenuRootContext } from '../root/MenuRootContext';

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

const listItem = useCompositeListItem({ label: () => props.label });
const thisTriggerId = useVaseUiId(() => props.id);

const open = computed(() => store.select('open'));
const floatingTreeRoot = computed(() => store.select('floatingTreeRoot'));
const popupId = computed(() => store.select('triggerPopupId', thisTriggerId.value));

const { registerTrigger } = useTriggerRegistration(thisTriggerId, store);

const triggerElement = shallowRef<HTMLElement | null>(null);

watch(
  () => props.closeDelay,
  (closeDelay) => store.set('closeDelay', closeDelay),
  { immediate: true },
);

const isDisabled = computed(
  () => props.disabled || store.select('disabled') || parentMenuStore.select('disabled'),
);

if (process.env.NODE_ENV !== 'production') {
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

const highlighted = computed(() => parentMenuStore.select('isActive', listItem.index.value));

const itemMetadata: UseMenuItemMetadata = {
  type: 'submenu-trigger',
  setActive(event: MouseEvent) {
    if (parentMenuStore.select('highlightItemOnHover')) {
      parentMenuStore.setActiveIndex(listItem.index.value, REASONS.pointer, event);
    }
  },
};

const { getItemProps, itemRef } = useMenuItem({
  closeOnClick: false,
  disabled: isDisabled,
  highlighted,
  id: thisTriggerId,
  store,
  typingRef: parentMenuStore.context.typingRef,
  nativeButton: () => props.nativeButton,
  itemMetadata,
});

// The handlers that one safe polygon makes share its timer, so each trigger has its own.
const handleClose = safePolygon({ blockPointerEvents: true });

const hoverProps = useHoverTriggerInteraction(store, {
  enabled: () => store.select('hoverEnabled') && props.openOnHover && !isDisabled.value,
  handleClose: () => handleClose,
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

const click = useClick(store, {
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

const rootTriggerProps = computed(() => store.select('triggerProps', true));

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
  onFocusout() {
    if (highlighted.value) {
      parentMenuStore.setActiveIndex(null, REASONS.none);
    }
  },
};

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: triggerOpenStateMapping,
  ref: [
    listItem.ref,
    itemRef,
    registerTrigger,
    (trigger) => {
      triggerElement.value = trigger;
    },
  ],
  props: (attrs) => [
    click.reference,
    hoverProps,
    rootTriggerProps.value,
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
    attrs,
    // `getItemProps` stays last so `useButton` keeps gating consumer handlers while disabled.
    getItemProps,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
