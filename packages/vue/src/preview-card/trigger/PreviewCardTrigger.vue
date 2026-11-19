<script lang="ts">
import type { AnchorHTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { PreviewCardHandle } from '../store/PreviewCardHandle';

export interface PreviewCardTriggerState {
  /**
   * Whether the preview card is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface PreviewCardTriggerProps<Payload = unknown>
  extends
    VaseUIComponentProps<PreviewCardTriggerState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<AnchorHTMLAttributes, 'id'>> {
  /**
   * A handle to associate the trigger with a preview card.
   */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * A payload to pass to the preview card when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before the preview card opens. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the preview card. Specified in milliseconds.
   * @default 300
   */
  closeDelay?: number | undefined;
  /**
   * The `id` of the link. A handle opens the preview card for the trigger with this `id`.
   * With no `id`, the trigger makes one.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts" generic="Payload = unknown">
import { computed } from 'vue';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { getInlineRectTriggerProps } from '../positioner/PreviewCardPositionerContext';
import { usePopupTrigger, useTriggerOwner } from '../../utils/popups/usePopupTrigger';
import { useHoverPointerStyle, usePopupHover } from '../../utils/popups/interactions/usePopupHover';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import type { PreviewCardHandleStore } from '../store/PreviewCardStore';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PreviewCardTriggerProps<Payload>>(), {
  as: 'a',
  delay: 600,
  closeDelay: 300,
});

defineSlots<{
  default(props: { state: PreviewCardTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps & AnchorHTMLAttributes, PreviewCardTriggerState>;
}>();

const rootStore = usePreviewCardRootContext(true)?.store;
const store = useTriggerOwner<PreviewCardHandleStore<unknown>>(
  rootStore,
  () => props.handle,
  'Vase UI: <PreviewCard.Trigger> must be inside <PreviewCard.Root>, or it must have a `handle`. Without a root the trigger has no preview card to open. Put the trigger inside <PreviewCard.Root>, or pass a `handle`.',
);

const thisTriggerId = useVaseUiId(() => props.id);

const {
  registerTrigger,
  useFocus,
  bindings: rootTriggerProps,
  isOpenedByThisTrigger,
  isTriggerActive,
  element: triggerElement,
} = usePopupTrigger(thisTriggerId, store, () => ({
  payload: props.payload,
  closeDelay: props.closeDelay,
}));

const hoverStyle = useHoverPointerStyle(triggerElement);
const hoverProps = usePopupHover(store).trigger({
  mouseOnly: true,
  move: false,
  safePolygon: true,
  delay: () => ({ open: props.delay, close: props.closeDelay }),
  triggerElement,
  isActiveTrigger: isTriggerActive,
});

const focusProps = useFocus({ delay: () => props.delay });

const inlineRectTriggerProps = getInlineRectTriggerProps(
  () => store.value.context.inlineRectCoordsRef,
  isOpenedByThisTrigger,
);

const state = computed<PreviewCardTriggerState>(() => ({ open: isOpenedByThisTrigger.value }));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('a', props, {
  state,
  ref: registerTrigger,
  stateAttributesMapping: triggerOpenStateMapping,
  props: (attrs) => [
    hoverProps,
    { style: hoverStyle.value },
    focusProps,
    rootTriggerProps.value,
    inlineRectTriggerProps,
    { id: thisTriggerId.value },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
