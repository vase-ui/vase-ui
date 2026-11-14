<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { MenuHandle } from '../store/MenuHandle';

export interface MenuTriggerState {
  /**
   * Whether the menu is currently open and was opened by this trigger.
   */
  open: boolean;
  /**
   * Whether the trigger is disabled.
   */
  disabled: boolean;
}

export interface MenuTriggerProps<Payload = unknown>
  extends
    NativeButtonProps,
    VaseUIComponentProps<MenuTriggerState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<ButtonHTMLAttributes, 'id' | 'disabled'>> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the trigger with a menu.
   */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * A payload to pass to the menu when it is opened.
   */
  payload?: Payload | undefined;
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
   */
  openOnHover?: boolean | undefined;
  /**
   * The id of the trigger. `triggerId` of the root and `open()` of a handle name a trigger by it.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts" generic="Payload = unknown">
import { computed, shallowRef } from 'vue';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { useButton } from '../../internals/use-button';
import { useMenubarContext } from '../../internals/menubar-context/MenubarContext';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useFocus } from '../../utils/popups/interactions/useFocus';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import {
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
} from '../../utils/popups/tree/FloatingTree';
import { FloatingTreeStore } from '../../utils/popups/tree/FloatingTreeStore';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
import type { MenuParent } from '../root/MenuRoot.vue';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuHandleStore } from '../store/MenuStore';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuTriggerProps<Payload>>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
  delay: 100,
  closeDelay: 0,
  openOnHover: undefined,
});

defineSlots<{
  default(props: { state: MenuTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuTriggerState>;
}>();

const rootContext = useMenuRootContext(true);
const handleStore = usePopupHandleStore(() => props.handle);
if (rootContext === undefined && props.handle === undefined) {
  throw new Error(
    'Vase UI: <Menu.Trigger> must be inside <Menu.Root>, or it must have a `handle`. Without a root the trigger has no menu to open. Put the trigger inside <Menu.Root>, or pass a `handle`.',
  );
}
const store = computed<MenuHandleStore<any>>(() => handleStore.value ?? rootContext!.store);

const thisTriggerId = useVaseUiId(() => props.id);

// A component keeps its provider chain, so the parent does not change.
const menubarContext = useMenubarContext(true);
const parent: MenuParent = menubarContext
  ? { type: 'menubar', context: menubarContext }
  : { type: undefined };
const isInMenubar = parent.type === 'menubar';
const compositeRootContext = useCompositeRootContext(true);

// A trigger with no tree above it, such as a detached trigger, makes the tree of its own.
const floatingTreeRootFromContext = useFloatingTree();
const ownFloatingTreeRoot = new FloatingTreeStore();
const floatingTreeRoot = computed(() => floatingTreeRootFromContext.value ?? ownFloatingTreeRoot);

const floatingNodeId = useFloatingNodeId(floatingTreeRoot);
const floatingParentNodeId = useFloatingParentNodeId();

const triggerElement = shallowRef<Element | null>(null);

const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
  thisTriggerId,
  store,
  () => ({
    payload: props.payload,
    closeDelay: props.closeDelay,
    parent,
    floatingTreeRoot: floatingTreeRoot.value,
    floatingNodeId,
    floatingParentNodeId: floatingParentNodeId.value,
    keyboardEventRelay: compositeRootContext?.relayKeyboardEvent,
  }),
);

const isTriggerActive = computed(() => store.value.select('isTriggerActive', thisTriggerId.value));
const isOpenedByThisTrigger = computed(() =>
  store.value.select('isOpenedByTrigger', thisTriggerId.value),
);
const controlsId = computed(() => store.value.select('triggerControlsId', thisTriggerId.value));

const isDisabled = computed(
  () =>
    props.disabled || store.value.select('disabled') || (menubarContext?.disabled.value ?? false),
);

const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
  native: () => props.nativeButton,
});

// In a menubar the trigger is an item of the composite of the menubar.
const compositeItem = isInMenubar ? useCompositeItem() : undefined;

const parentMenubarHasSubmenuOpen = computed(() => menubarContext?.hasSubmenuOpen.value ?? false);

// The handlers that one safe polygon makes share its timer, so each trigger has its own.
const handleClose = safePolygon({ blockPointerEvents: !isInMenubar });

const hoverProps = useHoverTriggerInteraction(store, {
  enabled: () =>
    (props.openOnHover ?? parentMenubarHasSubmenuOpen.value) &&
    !isDisabled.value &&
    (!isInMenubar || (parentMenubarHasSubmenuOpen.value && !isMountedByThisTrigger.value)),
  handleClose: () => handleClose,
  mouseOnly: true,
  move: false,
  restMs: () => (parent.type === undefined ? props.delay : undefined),
  delay: () => ({ close: props.closeDelay }),
  triggerElement,
  externalTree: floatingTreeRoot,
  isActiveTrigger: isTriggerActive,
});

const focusProps = useFocus(store, {
  enabled: () => !isDisabled.value && parentMenubarHasSubmenuOpen.value,
});

const rootTriggerProps = computed(() =>
  store.value.select('triggerProps', isMountedByThisTrigger.value),
);
// A filterable menu keeps real focus inside its popup and publishes what its trigger needs.
const filterTriggerProps = computed(() => store.value.select('filterTriggerProps'));

const state = computed<MenuTriggerState>(() => ({
  disabled: isDisabled.value,
  open: isOpenedByThisTrigger.value,
}));

const { element, elementProps } = useRenderElement('button', props, {
  state,
  stateAttributesMapping: pressableTriggerOpenStateMapping,
  ref: [
    compositeItem?.compositeRef,
    buttonRef,
    registerTrigger,
    (trigger) => {
      triggerElement.value = trigger;
    },
  ],
  props: (attrs) => [
    compositeItem?.compositeProps.value,
    focusProps,
    hoverProps,
    rootTriggerProps.value,
    {
      'aria-haspopup': 'menu',
      'aria-controls': controlsId.value,
      id: thisTriggerId.value,
    },
    filterTriggerProps.value,
    isInMenubar ? { role: 'menuitem' } : {},
    attrs,
    getButtonProps,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
