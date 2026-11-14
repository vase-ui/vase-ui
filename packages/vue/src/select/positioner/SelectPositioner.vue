<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';

export interface SelectPositionerState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface SelectPositionerProps
  extends
    VaseUIComponentProps<SelectPositionerState>,
    UseAnchorPositioningSharedParameters,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the positioner overlaps the trigger so the selected item's text is aligned with the trigger's value text. This only applies to mouse input and is automatically disabled if there is not enough space.
   * @default true
   */
  alignItemWithTrigger?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, provide, shallowRef, toRaw, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../internals/constants';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { findItemIndex } from '../../internals/itemEquality';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useAnchorPositioning } from '../../internals/useAnchorPositioning';
import { useVaseUIFloating } from '../../utils/popups/positioning/useFloating';
import { usePositioner } from '../../utils/popups/positioning/usePositioner';
import { clearStyles } from '../popup/utils';
import { useSelectRootContext } from '../root/SelectRootContext';
import { SelectPositionerContext } from './SelectPositionerContext';

const FIXED: CSSProperties = { position: 'fixed' };

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectPositionerProps>(), {
  as: 'div',
  disableAnchorTracking: false,
  align: 'center',
  alignOffset: 0,
  side: 'bottom',
  sideOffset: 0,
  arrowPadding: 5,
  collisionBoundary: 'clipping-ancestors',
  collisionPadding: 5,
  sticky: false,
  positionMethod: 'absolute',
  alignItemWithTrigger: true,
});

defineSlots<{
  default(props: { state: SelectPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectPositionerState>;
}>();

const store = useSelectRootContext();

const open = computed(() => store.select('open'));
const mounted = computed(() => store.select('mounted'));

// The popup turns the placement off for the rest of an open when the trigger has no room. The
// prop applies again only while the popup is not mounted.
const controlledAlignItemWithTrigger = shallowRef(props.alignItemWithTrigger);

watch(
  [mounted, () => props.alignItemWithTrigger],
  ([isMounted, alignItemWithTrigger]) => {
    if (!isMounted) {
      controlledAlignItemWithTrigger.value = alignItemWithTrigger;
    }
  },
  { flush: 'sync' },
);

const alignItemWithTriggerActive = computed(
  () =>
    mounted.value &&
    controlledAlignItemWithTrigger.value &&
    store.select('openMethod') !== 'touch',
);

// The trigger reads the value in its focus handler.
watch(
  alignItemWithTriggerActive,
  (active) => {
    store.context.alignItemWithTriggerActiveRef.value = active;
  },
  { flush: 'sync', immediate: true },
);
onScopeDispose(() => {
  store.context.alignItemWithTriggerActiveRef.value = false;
});

const positioning = useAnchorPositioning({
  anchor: () => props.anchor,
  positionMethod: () => props.positionMethod,
  side: () => props.side,
  sideOffset: () => props.sideOffset,
  align: () => props.align,
  alignOffset: () => props.alignOffset,
  arrowPadding: () => props.arrowPadding,
  collisionBoundary: () => props.collisionBoundary,
  collisionPadding: () => props.collisionPadding,
  sticky: () => props.sticky,
  // A Boolean prop is never `undefined`, so an explicit `false` cannot turn the tracking on while
  // the popup is over the trigger. The positioner does not use the anchored position then.
  disableAnchorTracking: () => props.disableAnchorTracking || alignItemWithTriggerActive.value,
  collisionAvoidance: () => props.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE,
  keepMounted: true,
  mounted,
  positionerElement: () => store.select('positionerElement'),
  defaultAnchor: () => store.select('anchor'),
});

useVaseUIFloating({ rootStore: store, mounted, positioning });

const renderedSide = computed(() =>
  alignItemWithTriggerActive.value ? ('none' as const) : positioning.side.value,
);

const state = computed<SelectPositionerState>(() => ({
  open: open.value,
  side: renderedSide.value,
  align: positioning.align.value,
  anchorHidden: positioning.anchorHidden.value,
}));

function writePopupSide() {
  store.set('popupSide', positioning.side.value);
}

onMounted(writePopupSide);
watch(positioning.side, writePopupSide);

let positionerElement: HTMLElement | null = null;

const { element, elementProps } = usePositioner(props, {
  state,
  styles: () => (alignItemWithTriggerActive.value ? FIXED : positioning.positionerStyles.value),
  transitionStatus: () => store.select('transitionStatus'),
  ref(positioner) {
    // A compiled template can mount a new positioner before it unmounts the old one. The old one
    // then must not clear the element of the new one.
    if (positioner !== null || toRaw(store.state).positionerElement === positionerElement) {
      store.set('positionerElement', positioner);
    }
    positionerElement = positioner;
  },
  hidden: () => !mounted.value,
  inert: () => !open.value,
});

let previousMapSize = 0;

useCompositeList({
  elementsRef: store.context.listRef,
  labelsRef: store.context.labelsRef,
  onMapChange(map) {
    const { listRef, valuesRef, itemValues } = store.context;
    // Vue runs this function before the `onMounted` hooks of the items that the update adds. The
    // values thus come from the elements, where each item writes its value in its first `ref` call.
    valuesRef.value = listRef.value.map((item) => (item ? itemValues.get(item) : undefined));

    const values = valuesRef.value;
    // `KeepAlive` takes the list out of the document, and the registry then has no item. No item
    // left the select, so the value stays.
    if (positionerElement?.isConnected === false) {
      return;
    }

    const previousSize = previousMapSize;
    previousMapSize = map.size;

    const { selectedValue: value, selectionMode } = toRaw(store.state);
    const { isItemEqualToValue } = store.context;
    const eventDetails = createChangeEventDetails(REASONS.none);

    if (previousSize !== 0 && selectionMode !== 'multiple' && value != null) {
      const selectedValueIndex = findItemIndex(values, value, isItemEqualToValue);
      if (selectedValueIndex === -1) {
        const initialSelectedValue = store.context.initialValueRef.value;
        const hasInitial =
          initialSelectedValue != null &&
          findItemIndex(values, initialSelectedValue, isItemEqualToValue) !== -1;
        const nextValue = hasInitial ? initialSelectedValue : null;
        store.context.setValue(nextValue, eventDetails);

        if (nextValue === null) {
          store.set('selectedIndex', null);
          store.context.selectedItemTextRef.value = null;
        }
      }
    }

    if (previousSize !== 0 && selectionMode === 'multiple' && Array.isArray(value)) {
      const nextValue = value.filter(
        (selectedItemValue) => findItemIndex(values, selectedItemValue, isItemEqualToValue) !== -1,
      );
      if (nextValue.length !== value.length) {
        store.context.setValue(nextValue, eventDetails);

        if (nextValue.length === 0) {
          store.set('selectedIndex', null);
          store.context.selectedItemTextRef.value = null;
        }
      }
    }

    if (open.value && alignItemWithTriggerActive.value) {
      store.update({
        scrollUpArrowVisible: false,
        scrollDownArrowVisible: false,
      });

      const stylesToClear: CSSProperties = { height: '' };
      clearStyles(positionerElement, stylesToClear);
      clearStyles(store.context.popupRef.value, stylesToClear);
    }
  },
});

// The items leave with the positioner, and the root must then find no value of an item.
onScopeDispose(() => {
  store.context.valuesRef.value = [];
});

provide(SelectPositionerContext, {
  align: positioning.align,
  arrowRef: positioning.arrowRef,
  arrowUncentered: positioning.arrowUncentered,
  arrowStyles: positioning.arrowStyles,
  isPositioned: positioning.isPositioned,
  side: renderedSide,
  alignItemWithTriggerActive,
  setControlledAlignItemWithTrigger(alignItemWithTrigger) {
    controlledAlignItemWithTrigger.value = alignItemWithTrigger;
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
