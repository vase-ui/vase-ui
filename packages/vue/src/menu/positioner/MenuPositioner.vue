<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';

export interface MenuPositionerState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether the component is nested.
   */
  nested: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: string | undefined;
}

export interface MenuPositionerProps
  extends
    VaseUIComponentProps<MenuPositionerState>,
    Omit<UseAnchorPositioningSharedParameters, 'side' | 'align'>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * How to align the popup relative to the specified side.
   *
   * Submenus and menubars default to `'start'`.
   * @default 'center'
   */
  align?: Align | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   *
   * Submenus and vertical menubars default to `'inline-end'`.
   * @default 'bottom'
   */
  side?: Side | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, provide, toRaw, watch } from 'vue';
import { useTimeout } from '../../common/useTimeout';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { useContextMenuRootContext } from '../../internals/context-menu-root-context/ContextMenuRootContext';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { usePopupPositioner } from '../../utils/popups/popupPositioner';
import { provideFloatingNode } from '../../utils/popups/tree/FloatingTree';
import { useAnchoredPopupScrollLock } from '../../utils/popups/useAnchoredPopupScrollLock';
import { useMenuPortalContext } from '../portal/MenuPortalContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuRootChangeEventReason } from '../root/MenuRoot.vue';
import type { MenuOpenEventDetails } from '../utils/types';
import { MenuPositionerContext } from './MenuPositionerContext';

defineOptions({ inheritAttrs: false });

// `side`, `align` and the offsets have no default here, because the part gives each of them a
// default from the parent of the menu.
const props = withDefaults(defineProps<MenuPositionerProps>(), {
  as: 'div',
  positionMethod: 'absolute',
  collisionBoundary: 'clipping-ancestors',
  collisionPadding: 5,
  arrowPadding: 5,
  sticky: false,
  disableAnchorTracking: false,
});

defineSlots<{
  default(props: { state: MenuPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuPositionerState>;
}>();

const { store, virtualFocus, syncHighlightedItem } = useMenuRootContext();
const keepMounted = useMenuPortalContext();
const contextMenuContext = useContextMenuRootContext();

const parent = computed(() => store.select('parent'));
const floatingTreeRoot = computed(() => store.select('floatingTreeRoot'));
const floatingNodeId = computed(() => store.select('floatingNodeId'));
const floatingParentNodeId = computed(() => store.select('floatingParentNodeId'));
const triggerElement = computed(() => store.select('activeTriggerElement'));

// The place of the menu gives the defaults of the props that the consumer did not set.
const resolvedProps = computed(() => {
  const currentParent = parent.value;
  let anchor = props.anchor;
  let sideOffset = props.sideOffset;
  let alignOffset = props.alignOffset;
  let align = props.align;
  if (currentParent.type === 'context-menu') {
    anchor = anchor ?? currentParent.context.anchor;
    align = align ?? 'start';
    if (!props.side && align !== 'center') {
      alignOffset = props.alignOffset ?? 2;
      sideOffset = props.sideOffset ?? -5;
    }
  }

  let side = props.side;
  if (currentParent.type === 'menu') {
    side = side ?? 'inline-end';
    align = align ?? 'start';
  } else if (currentParent.type === 'menubar') {
    side =
      side ?? (currentParent.context.orientation.value === 'vertical' ? 'inline-end' : 'bottom');
    align = align ?? 'start';
  }

  const defaultCollisionAvoidance =
    currentParent.type === 'menu' ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE;

  return {
    anchor,
    sideOffset,
    alignOffset,
    align,
    side,
    collisionAvoidance: props.collisionAvoidance ?? defaultCollisionAvoidance,
  };
});

const isContextMenu = computed(() => parent.value.type === 'context-menu');

const { element, elementProps, state, positioning, open } = usePopupPositioner<MenuPositionerState>(
  store,
  props,
  {
    keepMounted,
    positioning: {
      anchor: () => resolvedProps.value.anchor,
      collisionAvoidance: () => resolvedProps.value.collisionAvoidance,
      positionMethod: () => (contextMenuContext ? 'fixed' : props.positionMethod),
      side: () => resolvedProps.value.side,
      sideOffset: () => resolvedProps.value.sideOffset,
      align: () => resolvedProps.value.align,
      alignOffset: () => resolvedProps.value.alignOffset,
      arrowPadding: () => (isContextMenu.value ? 0 : props.arrowPadding),
      nodeId: floatingNodeId,
      shift: () => {
        if (!isContextMenu.value) {
          return undefined;
        }
        const collisionAvoidance = resolvedProps.value.collisionAvoidance;
        return {
          crossAxis: !('side' in collisionAvoidance && collisionAvoidance.side === 'flip'),
          rootBoundary: 'layoutViewport',
        };
      },
      externalTree: floatingTreeRoot,
      lazyFlip: virtualFocus ? 'placement' : false,
    },
    state: () => ({ nested: parent.value.type === 'menu' }),
  },
);

provide(MenuPositionerContext, positioning);
provideFloatingNode(floatingNodeId);

useCompositeList({
  elementsRef: store.context.itemDomElements,
  labelsRef: store.context.itemLabels,
  onMapChange: syncHighlightedItem,
});

watch(
  [floatingTreeRoot, floatingNodeId],
  ([tree, nodeId], _previous, onCleanup) => {
    function onMenuOpenChange(details: MenuOpenEventDetails) {
      if (!details.open) {
        return;
      }

      if (details.parentNodeId === nodeId) {
        store.set('hoverEnabled', false);
      }
      // A submenu that is already closed has nothing to close, and a dropped close would cancel
      // a hover open it has pending. This mirrors the drop rule in `setOpen`.
      const { open: isOpen, openProp } = toRaw(store.state);
      if (
        details.nodeId !== nodeId &&
        details.parentNodeId === store.select('floatingParentNodeId') &&
        (isOpen || openProp)
      ) {
        store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
      }
    }

    tree.events.on('menuopenchange', onMenuOpenChange);
    onCleanup(() => tree.events.off('menuopenchange', onMenuOpenChange));
  },
  { immediate: true },
);

watch(
  floatingTreeRoot,
  (tree, _previous, onCleanup) => {
    if (store.select('floatingParentNodeId') == null) {
      return;
    }

    function onParentClose(details: MenuOpenEventDetails) {
      if (details.open || details.nodeId !== store.select('floatingParentNodeId')) {
        return;
      }

      const reason: MenuRootChangeEventReason = details.reason ?? REASONS.siblingOpen;
      store.setOpen(false, createChangeEventDetails(reason));
    }

    tree.events.on('menuopenchange', onParentClose);
    onCleanup(() => tree.events.off('menuopenchange', onParentClose));
  },
  { immediate: true },
);

const closeTimeout = useTimeout();

watch(open, (isOpen) => {
  if (!isOpen) {
    closeTimeout.clear();
  }
});

watch(
  floatingTreeRoot,
  (tree, _previous, onCleanup) => {
    function onItemHover(event: { nodeId: string | undefined; target: Element | null }) {
      // If an item within our parent menu is hovered, and this menu's trigger is not that item,
      // close this submenu. This ensures hovering a different item in the parent closes other
      // branches.
      if (!open.value || event.nodeId !== store.select('floatingParentNodeId')) {
        return;
      }

      const trigger = triggerElement.value;
      if (event.target && trigger && trigger !== event.target) {
        const delay = store.select('closeDelay');
        if (delay > 0) {
          if (!closeTimeout.isStarted()) {
            closeTimeout.start(delay, () => {
              store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
            });
          }
        } else {
          store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
        }
      } else {
        // User re-hovered the submenu trigger, cancel pending close.
        closeTimeout.clear();
      }
    }

    tree.events.on('itemhover', onItemHover);
    onCleanup(() => tree.events.off('itemhover', onItemHover));
  },
  { immediate: true },
);

function emitOpenChange() {
  const details: MenuOpenEventDetails = {
    open: open.value,
    nodeId: floatingNodeId.value,
    parentNodeId: floatingParentNodeId.value,
    reason: store.select('lastOpenChangeReason'),
  };

  floatingTreeRoot.value.events.emit('menuopenchange', details);
}

onMounted(emitOpenChange);
watch([floatingTreeRoot, open, floatingNodeId, floatingParentNodeId], emitOpenChange, {
  flush: 'post',
});

useAnchoredPopupScrollLock(
  () => {
    const currentParent = parent.value;
    const menubarModal = currentParent.type === 'menubar' && currentParent.context.modal.value;
    const popupModal =
      store.select('modal') && store.select('lastOpenChangeReason') !== REASONS.triggerHover;
    return open.value && (menubarModal || popupModal);
  },
  () => store.select('openMethod') === 'touch',
  () => store.select('positionerElement'),
  triggerElement,
);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
