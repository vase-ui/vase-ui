<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';

export interface ComboboxPositionerState {
  /**
   * Whether the popup is currently open.
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
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxPositionerProps
  extends
    VaseUIComponentProps<ComboboxPositionerState>,
    UseAnchorPositioningSharedParameters,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, onMounted, provide, watch } from 'vue';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../internals/constants';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import InternalBackdrop from '../../utils/popups/InternalBackdrop.vue';
import { usePopupPositioner } from '../../utils/popups/popupPositioner';
import { useAnchoredPopupScrollLock } from '../../utils/popups/useAnchoredPopupScrollLock';
import { useComboboxPortalContext } from '../portal/ComboboxPortalContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useListEmpty } from '../utils/parts';
import { ComboboxPositionerContext } from './ComboboxPositionerContext';

// The shared positioner state also carries `instant`, which a combobox never sets.
type ComboboxPositionerInternalState = ComboboxPositionerState & { instant: undefined };

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxPositionerProps>(), {
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
  default(props: { state: ComboboxPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxPositionerState>;
}>();

const store = useComboboxRootContext();
const keepMounted = useComboboxPortalContext();

const modal = computed(() => store.select('modal'));
const triggerElement = computed(() => store.select('triggerElement'));
const inputElement = computed(() => store.select('inputElement'));
const inputGroupElement = computed(() => store.select('inputGroupElement'));

const empty = useListEmpty();

const { element, elementProps, state, positioning, open, mounted } =
  usePopupPositioner<ComboboxPositionerInternalState>(store, props, {
    keepMounted,
    positioning: {
      anchor: () =>
        props.anchor ??
        (store.select('inputInsidePopup')
          ? triggerElement.value
          : (inputGroupElement.value ?? inputElement.value)),
      collisionAvoidance: () => props.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE,
      lazyFlip: true,
    },
    state: () => ({ empty: empty.value }),
  });

useAnchoredPopupScrollLock(
  () => open.value && modal.value,
  () => store.select('openMethod') === 'touch',
  () => store.select('positionerElement'),
  triggerElement,
);

function writePopupSide() {
  store.set('popupSide', positioning.side.value);
}

onMounted(writePopupSide);
watch(positioning.side, writePopupSide);

provide(ComboboxPositionerContext, positioning);

defineExpose({ element });
</script>

<template>
  <InternalBackdrop
    v-if="mounted && modal"
    :inert="!open"
    :cutout="inputGroupElement ?? inputElement ?? triggerElement"
  />
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
