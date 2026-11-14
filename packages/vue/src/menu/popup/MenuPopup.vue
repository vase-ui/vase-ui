<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

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
}
</script>

<script setup lang="ts">
import { computed, onScopeDispose, toRaw, watch } from 'vue';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import type { MenuRootChangeEventReason } from '../root/MenuRoot.vue';
import { useMenuRootContext } from '../root/MenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuPopupProps>(), { as: 'div' });

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

const state = computed<MenuPopupState>(() => ({
  transitionStatus: transitionStatus.value,
  side: side.value,
  align: align.value,
  open: open.value,
  nested: store.select('parent').type === 'menu',
  instant: store.select('instantType'),
}));

// An `aria-label` or an `aria-labelledby` of the part replaces the label from the trigger. The part
// reads only its own attributes. An `aria-labelledby` on the element of a `#render` slot also
// replaces the label, because the element sets it after the props. An `aria-label` on that element
// does not, because the part does not see it. The popup then keeps the `aria-labelledby` of the
// trigger.
function getAriaLabelledBy(attrs: Record<string, unknown>) {
  const ariaLabelledBy = attrs['aria-labelledby'] as string | undefined;
  if (ariaLabelledBy != null || attrs['aria-label']) {
    return ariaLabelledBy;
  }

  // Prefer the live id of the element: the own `id` of an element from a `#render` slot wins over
  // the registered one.
  const activeTriggerElement = store.select('activeTriggerElement');
  return (
    (activeTriggerElement ? activeTriggerElement.id : store.select('activeTriggerId')) || undefined
  );
}

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
      role: 'menu',
      // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
      'aria-orientation': orientation.value === 'horizontal' ? 'horizontal' : undefined,
      'aria-labelledby': getAriaLabelledBy(attrs),
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

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
