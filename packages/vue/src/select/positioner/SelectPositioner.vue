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
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, onMounted, provide, toRaw, watch } from 'vue';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../internals/constants';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { findItemIndex } from '../../internals/itemEquality';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useAnchorPositioning } from '../../internals/useAnchorPositioning';
import { useVaseUIFloating } from '../../utils/popups/positioning/useFloating';
import { usePositioner } from '../../utils/popups/positioning/usePositioner';
import { useSelectRootContext } from '../root/SelectRootContext';
import { SelectPositionerContext } from './SelectPositionerContext';

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
});

defineSlots<{
  default(props: { state: SelectPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectPositionerState>;
}>();

const store = useSelectRootContext();

const open = computed(() => store.select('open'));
const mounted = computed(() => store.select('mounted'));

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
  disableAnchorTracking: () => props.disableAnchorTracking,
  collisionAvoidance: () => props.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE,
  keepMounted: true,
  mounted,
  positionerElement: () => store.select('positionerElement'),
  defaultAnchor: () => store.select('anchor'),
});

useVaseUIFloating({ rootStore: store, mounted, positioning });

const state = computed<SelectPositionerState>(() => ({
  open: open.value,
  side: positioning.side.value,
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
  styles: positioning.positionerStyles,
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
    if (values.length === 0) {
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
  },
});

provide(SelectPositionerContext, positioning);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
