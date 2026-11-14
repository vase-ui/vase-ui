<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { TooltipHandle } from '../store/TooltipHandle';

export interface TooltipTriggerState {
  /**
   * Whether the tooltip is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface TooltipTriggerProps<Payload = unknown>
  extends
    VaseUIComponentProps<TooltipTriggerState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<ButtonHTMLAttributes, 'id' | 'disabled'>> {
  /**
   * A handle to associate the trigger with a tooltip.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * A payload to pass to the tooltip when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before opening the tooltip on hover. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * Whether the tooltip should close when this trigger is clicked.
   * @default true
   */
  closeOnClick?: boolean | undefined;
  /**
   * How long to wait before closing the tooltip. Specified in milliseconds.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * If `true`, the tooltip will not open when interacting with this trigger.
   * Note that this doesn't apply the `disabled` attribute to the trigger element.
   * If you want to disable the trigger element itself, you can pass the `disabled` prop to the
   * trigger element with the `#render` slot.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The id of the trigger. `triggerId` of the root and `open()` of a handle name a trigger by it.
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
import { useTooltipRootContext } from '../root/TooltipRootContext';
import type { TooltipHandleStore } from '../store/TooltipStore';
import { OPEN_DELAY } from '../utils/constants';
import * as TooltipTriggerDataAttributes from './TooltipTriggerDataAttributes';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipTriggerProps<Payload>>(), {
  as: 'button',
  closeOnClick: true,
  disabled: false,
  delay: undefined,
  closeDelay: undefined,
});

defineSlots<{
  default(props: { state: TooltipTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, TooltipTriggerState>;
}>();

const rootStore = useTooltipRootContext(true);
const handleStore = usePopupHandleStore(() => props.handle);
if (rootStore === undefined && props.handle === undefined) {
  throw new Error(
    'Vase UI: <Tooltip.Trigger> must be inside <Tooltip.Root>, or it must have a `handle`. Without a root the trigger has no tooltip to open. Put the trigger inside <Tooltip.Root>, or pass a `handle`.',
  );
}
const store = computed<TooltipHandleStore<any>>(() => handleStore.value ?? rootStore!);

const thisTriggerId = useVaseUiId(() => props.id);
const isOpenedByThisTrigger = computed(() =>
  store.value.select('isOpenedByTrigger', thisTriggerId.value),
);

const triggerElement = shallowRef<Element | null>(null);

const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
  thisTriggerId,
  store,
  () => ({
    payload: props.payload,
    closeOnClick: props.closeOnClick,
    closeDelay: props.closeDelay ?? 0,
  }),
);

const isDisabled = computed(() => props.disabled || store.value.select('disabled'));
const rootTriggerProps = computed(() =>
  store.value.select('appliedTriggerProps', isMountedByThisTrigger.value),
);

const hoverProps = useHoverTriggerInteraction(store, {
  enabled: () => !isDisabled.value,
  mouseOnly: true,
  move: false,
  restMs: () => props.delay ?? OPEN_DELAY,
  delay: () => ({ close: props.closeDelay ?? 0 }),
  triggerElement,
});

function cancelPendingOpen(event: MouseEvent | PointerEvent) {
  if (props.closeOnClick && !store.value.select('open')) {
    store.value.cancelPendingOpen(event);
  }
}

const state = computed<TooltipTriggerState>(() => ({ open: isOpenedByThisTrigger.value }));

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [
    registerTrigger,
    (trigger) => {
      triggerElement.value = trigger;
    },
  ],
  stateAttributesMapping: triggerOpenStateMapping,
  props: (attrs) => [
    hoverProps,
    rootTriggerProps.value,
    {
      onPointerdown: cancelPendingOpen,
      onClick: cancelPendingOpen,
      id: thisTriggerId.value,
      [TooltipTriggerDataAttributes.triggerDisabled]: isDisabled.value ? '' : undefined,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
