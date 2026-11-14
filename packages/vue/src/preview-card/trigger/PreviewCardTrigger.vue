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
import { computed, shallowRef } from 'vue';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
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

const rootStore = usePreviewCardRootContext(true);
const handleStore = usePopupHandleStore(() => props.handle);
if (rootStore === undefined && props.handle === undefined) {
  throw new Error(
    'Vase UI: <PreviewCard.Trigger> must be inside <PreviewCard.Root>, or it must have a `handle`. Without a root the trigger has no preview card to open. Put the trigger inside <PreviewCard.Root>, or pass a `handle`.',
  );
}
const store = computed<PreviewCardHandleStore<any>>(() => handleStore.value ?? rootStore!);

const thisTriggerId = useVaseUiId(() => props.id);
const isOpenedByThisTrigger = computed(() =>
  store.value.select('isOpenedByTrigger', thisTriggerId.value),
);

const triggerElement = shallowRef<Element | null>(null);

const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
  thisTriggerId,
  store,
  () => ({ payload: props.payload, closeDelay: props.closeDelay }),
);

const rootTriggerProps = computed(() =>
  store.value.select('triggerProps', isMountedByThisTrigger.value),
);

const hoverProps = useHoverTriggerInteraction(store, {
  mouseOnly: true,
  move: false,
  delay: () => ({ open: props.delay, close: props.closeDelay }),
  triggerElement,
});

const state = computed<PreviewCardTriggerState>(() => ({ open: isOpenedByThisTrigger.value }));

const { element, elementProps } = useRenderElement('a', props, {
  state,
  ref: [
    registerTrigger,
    (trigger) => {
      triggerElement.value = trigger;
    },
  ],
  stateAttributesMapping: triggerOpenStateMapping,
  props: (attrs) => [hoverProps, rootTriggerProps.value, { id: thisTriggerId.value }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
