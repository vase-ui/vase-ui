<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FocusOption } from '../../utils/popups/focus/usePopupFocus';

export interface MenuPopupState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * Whether the component is nested.
   */
  nested: boolean;
  /**
   * Whether transitions should be skipped.
   */
  instant: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
}

export interface MenuPopupProps
  extends
    VaseUIComponentProps<MenuPopupState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Determines the element to focus when the menu is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element, a component, or a ref of one: Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusOption | undefined;
}
</script>

<script setup lang="ts">
import { popupBindings } from '../../utils/popups/popupBindings';
import { menuPopups } from '../../utils/popups/registeredParts';
import { useElementRegistration } from '../../internals/useElementRegistration';
import { computed, inject, provide, toRaw, watch } from 'vue';
import { contains } from '../../common/shadowDom';
import { COMPOSITE_KEYS } from '../../internals/composite/listIndex';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { given } from '../../internals/givenAttributes';
import { REASONS } from '../../internals/reasons';
import { resolvePopupLabel } from '../../internals/resolvePopupLabel';
import type { ComponentRenderFn, HTMLProps, VaseUIEvent } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { PopupStyleContext } from '../../utils/popups/viewport/PopupViewportContext';
import { usePopupFocus } from '../../utils/popups/focus/usePopupFocus';
import { usePopupHover } from '../../utils/popups/interactions/usePopupHover';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { createElementSetter, popupElementTarget } from '../../utils/popups/createElementSetter';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { MenuFilterImplContext, useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import type { MenuRootChangeEventReason } from '../root/MenuRoot.vue';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuPopupProps>(), { as: 'div', finalFocus: undefined });

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Menu.Popup');
}

defineSlots<{
  default(props: { state: MenuPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuPopupState>;
}>();

const { store, popupLabelId, orientation, virtualFocus } = useMenuRootContext();
const inheritedSubmenuRootContext = useMenuSubmenuRootContext();
const { side, align } = useMenuPositionerContext();
const insideToolbar = useToolbarRootContext(true) !== undefined;
// A filterable menu makes the popup a dialog that holds the input, and the input takes the focus.
const filterPopup = useMenuFilterImpl()?.usePopup();

const open = computed(() => store.select('open'));
const transitionStatus = computed(() => store.select('transitionStatus'));
const floatingTreeRoot = computed(() => store.select('floatingTreeRoot'));
const mounted = computed(() => store.select('mounted'));
const parent = computed(() => store.select('parent'));
// A dialog menu can be in the part of a submenu root. Only the real submenu reads its context.
const submenuRootContext = computed(() =>
  parent.value.type === 'menu' ? inheritedSubmenuRootContext : undefined,
);
// The store types a trigger as an `Element`. A trigger part renders an `HTMLElement`.
const activeTriggerElement = computed(
  () => store.select('activeTriggerElement') as HTMLElement | null,
);

watch(
  floatingTreeRoot,
  (tree, _previous, onCleanup) => {
    function handleClose(event: {
      domEvent: Event | undefined;
      reason: MenuRootChangeEventReason;
    }) {
      store.setOpen(false, createChangeEventDetails(event.reason, event.domEvent));
    }

    tree.events.on('close', handleClose);
    onCleanup(() => tree.events.off('close', handleClose));
  },
  { immediate: true },
);

// Only a menu under a filterable root bundles the handoff to a filterable parent. Whether one is
// above is fixed for a mounted popup.
const parentHandoff = inject(MenuFilterImplContext, null)?.useParentHandoff(
  store,
  parent.value,
  open,
  virtualFocus,
);

usePopupHover(store).popup({
  enabled: () => {
    const parentType = store.select('parent').type;
    return (
      store.select('hoverEnabled') &&
      !store.select('disabled') &&
      parentType !== 'context-menu' &&
      parentType !== 'menubar'
    );
  },
  closeDelay: () => store.select('closeDelay'),
});

const state = computed<MenuPopupState>(() => ({
  transitionStatus: transitionStatus.value,
  side: side.value,
  align: align.value,
  open: open.value,
  nested: store.select('parent').type === 'menu',
  instant: store.select('instantType'),
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  MenuPopupState,
  HTMLElement
>('div', props, {
  state,
  ref: createElementSetter(popupElementTarget(store)),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    // This listener runs after each other listener of the popup.
    { onKeydown: parentHandoff?.sendKeyToParentList },
    popupBindings(store),
    { style: store.context.viewportStyles.value?.popup.value },
    {
      id: given('id', props.id) ?? store.select('defaultPopupId'),
      // A rendered `Menu.List` carries the `menu` semantics instead.
      ...(store.select('listElement')
        ? { role: 'presentation' }
        : {
            role: 'menu',
            // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
            'aria-orientation': orientation.value === 'horizontal' ? 'horizontal' : undefined,
            'aria-labelledby': resolvePopupLabel(attrs, popupLabelId.value),
          }),
      onKeydown(event: VaseUIEvent<KeyboardEvent>) {
        // The handlers to the left also handle the keys of the items and of `Menu.Input`. A call of
        // `event.preventVaseUIHandler()` in a listener of such a part thus stops them too.
        if (event.vaseUIHandlerPrevented) {
          event.preventVaseUIHandler();
        }
        submenuRootContext.value?.onPopupKeydown?.(event);
        if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
          event.stopPropagation();
        }
      },
      onFocusin: parentHandoff?.handleFocus,
    },
    getDisabledMountTransitionStyles(transitionStatus.value),
    focusBindings(attrs),
    filterPopup ? filterPopup.props(attrs) : attrs,
    // This listener runs before each other listener of the popup.
    {
      'data-rootownerid': store.select('rootId'),
      onKeydown: parentHandoff?.stopParentNavigationKey,
    },
  ],
});

const initialFocus = computed<FocusOption>(() => {
  if (filterPopup) {
    return filterPopup.initialFocus.value;
  }
  if (parent.value.type === 'menu') {
    return false;
  }
  const listElement = store.select('listElement');
  if (!listElement) {
    return true;
  }
  return () => {
    // A keyboard or screen reader open highlights an item, which list navigation focuses.
    if (toRaw(store.state).activeIndex !== null) {
      return false;
    }
    // The list holds the `menu` role, so a pointer open lands focus on it rather than on the
    // presentational popup.
    return listElement;
  };
});

// After the close, a root outside the menubar writes its own node ids to its store, and the menubar
// is not the parent of that node. The search thus finds the open menu by its trigger in the menubar
// element.
function getOpenMenubarTrigger() {
  const menuParent = parent.value;
  const menubarElement =
    menuParent.type === 'menubar' ? menuParent.context.contentElement.value : null;
  const openNode = store
    .select('floatingTreeRoot')
    .nodesRef.value.find(
      (node) => node.context?.open && contains(menubarElement, node.context.elements.domReference),
    );
  return openNode?.context?.elements.domReference ?? true;
}

// These targets are internal defaults, not targets of the consumer: the focus manager keeps a
// focus that moved. The input of a filtered parent menu holds the real focus while the parent
// highlights an item. A menu of a menubar that closes for another menu gives the focus to the
// trigger of that menu, because a focus on its own trigger can open it again.
const dynamicReturnFocus = computed(
  () =>
    parentHandoff?.parentVirtualFocusRef ??
    (parent.value.type === 'menubar' && store.select('lastOpenChangeReason') === REASONS.siblingOpen
      ? getOpenMenubarTrigger
      : undefined),
);

const returnFocus = computed(() => {
  const { type } = parent.value;
  return (
    activeTriggerElement.value != null ||
    type === undefined ||
    type === 'context-menu' ||
    (type === 'menubar' && store.select('lastOpenChangeReason') !== REASONS.outsidePress)
  );
});

// The trigger writes its guards to the store after the popup opens, so the focus manager reads the
// refs when it needs them.
function getInsideElements() {
  return [store.context.beforeTriggerFocusGuardRef.value];
}

function getNextFocusableElement() {
  return store.context.triggerFocusTargetRef.value;
}

const focusBindings = usePopupFocus(
  () => ({
    store,
    openInteractionType: store.select('openMethod'),
    modal: parent.value.type === 'context-menu',
    disabled: !mounted.value,
    returnFocus: props.finalFocus ?? dynamicReturnFocus.value ?? returnFocus.value,
    explicitReturnFocus:
      props.finalFocus === undefined && dynamicReturnFocus.value ? false : undefined,
    initialFocus: initialFocus.value,
    restoreFocus: true,
    getInsideElements: parent.value.type === undefined ? getInsideElements : undefined,
    externalTree: parent.value.type !== 'menubar' ? floatingTreeRoot.value : undefined,
    previousFocusableElement: activeTriggerElement.value,
    nextFocusableElement: parent.value.type === undefined ? getNextFocusableElement : undefined,
    beforeContentFocusGuardRef: store.context.beforeContentFocusGuardRef,
    afterContentFocusGuardRef: store.context.afterContentFocusGuardRef,
  }),
  element,
);

useElementRegistration(menuPopups, element, () => store.select('rootId'));
provide(PopupStyleContext, () => elementProps().style);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
