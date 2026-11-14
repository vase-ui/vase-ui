<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FocusOption } from '../../utils/popups/focus/FloatingFocusManager.vue';

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
import { computed, onScopeDispose, toRaw, watch } from 'vue';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { REASONS } from '../../internals/reasons';
import { resolvePopupLabel } from '../../internals/resolvePopupLabel';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useHoverPopupInteraction } from '../../utils/popups/interactions/useHoverPopupInteraction';
import FloatingFocusManager from '../../utils/popups/focus/FloatingFocusManager.vue';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import type { MenuRootChangeEventReason } from '../root/MenuRoot.vue';
import { useMenuRootContext } from '../root/MenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuPopupProps>(), { as: 'div', finalFocus: undefined });

defineSlots<{
  default(props: { state: MenuPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuPopupState>;
}>();

const { store, generatedPopupId, setRenderedPopupId, orientation } = useMenuRootContext();
const { side, align } = useMenuPositionerContext();
const insideToolbar = useToolbarRootContext(true) !== undefined;

const open = computed(() => store.select('open'));
const transitionStatus = computed(() => store.select('transitionStatus'));
const floatingTreeRoot = computed(() => store.select('floatingTreeRoot'));
const mounted = computed(() => store.select('mounted'));
const parent = computed(() => store.select('parent'));
// The store types a trigger as an `Element`. A trigger part renders an `HTMLElement`.
const activeTriggerElement = computed(
  () => store.select('activeTriggerElement') as HTMLElement | null,
);

const popupId = computed(() => props.id ?? generatedPopupId);

// The root names the popup with the id that the popup renders. A generated id is not a request, so
// removing an explicit id gives the generated id back.
watch(() => (popupId.value === generatedPopupId ? undefined : popupId.value), setRenderedPopupId, {
  immediate: true,
});
onScopeDispose(() => setRenderedPopupId(undefined));

useOpenChangeComplete({
  open,
  ref: store.context.popupRef,
  onComplete() {
    if (open.value) {
      store.context.onOpenChangeComplete?.(true);
    }
  },
});

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

useHoverPopupInteraction(store, {
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

let popupElement: HTMLElement | null = null;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [
    (popup) => {
      // A compiled template can mount a new popup before it unmounts the old one. The old popup
      // then must not clear the element of the new one.
      if (popup !== null || toRaw(store.state).popupElement === popupElement) {
        store.context.popupRef.value = popup;
        store.set('popupElement', popup);
      }
      popupElement = popup;
    },
  ],
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    store.select('popupProps'),
    {
      id: popupId.value,
      // A rendered `Menu.List` carries the `menu` semantics instead.
      ...(store.select('listElement')
        ? { role: 'presentation' }
        : {
            role: 'menu',
            // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
            'aria-orientation': orientation.value === 'horizontal' ? 'horizontal' : undefined,
            'aria-labelledby': resolvePopupLabel(
              attrs,
              store.select('activeTriggerElement'),
              store.select('activeTriggerId'),
            ),
          }),
      onKeydown(event: KeyboardEvent) {
        if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
          event.stopPropagation();
        }
      },
    },
    getDisabledMountTransitionStyles(transitionStatus.value),
    attrs,
    { 'data-rootownerid': store.select('rootId') },
  ],
});

const initialFocus = computed<FocusOption>(() => {
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

defineExpose({ element });
</script>

<template>
  <FloatingFocusManager
    :store="store"
    :open-interaction-type="store.select('openMethod')"
    :modal="parent.type === 'context-menu'"
    :disabled="!mounted"
    :return-focus="finalFocus ?? returnFocus"
    :initial-focus="initialFocus"
    restore-focus
    :get-inside-elements="parent.type === undefined ? getInsideElements : undefined"
    :external-tree="parent.type !== 'menubar' ? floatingTreeRoot : undefined"
    :previous-focusable-element="activeTriggerElement"
    :next-focusable-element="parent.type === undefined ? getNextFocusableElement : undefined"
    :before-content-focus-guard-ref="store.context.beforeContentFocusGuardRef"
  >
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </FloatingFocusManager>
</template>
