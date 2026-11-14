<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { PopoverHandle } from '../store/PopoverHandle';

export interface PopoverTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the popover is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface PopoverTriggerProps<Payload = unknown>
  extends
    NativeButtonProps,
    VaseUIComponentProps<PopoverTriggerState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled' | 'id'> {
  /**
   * Whether the trigger should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the trigger with a popover.
   */
  handle?: PopoverHandle<Payload> | undefined;
  /**
   * A payload to pass to the popover when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the popover in controlled mode (with the PopoverRoot `triggerId` prop).
   */
  id?: string | undefined;
  /**
   * Whether the popover should also open when the trigger is hovered.
   * @default false
   */
  openOnHover?: boolean | undefined;
  /**
   * How long to wait before the popover may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 300
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the popover that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
}
</script>

<script setup lang="ts" generic="Payload = unknown">
import { computed, shallowRef } from 'vue';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { useOpenMethodTriggerProps } from '../../utils/popups/interactions/useOpenInteractionType';
import {
  pressableTriggerOpenStateMapping,
  triggerOpenStateMapping,
} from '../../utils/popups/popupStateMapping';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
import { useTriggerFocusGuards } from '../../utils/popups/useTriggerFocusGuards';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import type { PopoverHandleStore } from '../store/PopoverStore';
import { OPEN_DELAY } from '../utils/constants';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverTriggerProps<Payload>>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
  openOnHover: false,
  delay: OPEN_DELAY,
  closeDelay: 0,
});

defineSlots<{
  default(props: { state: PopoverTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverTriggerState>;
}>();

const rootStore = usePopoverRootContext(true);
const handleStore = usePopupHandleStore(() => props.handle);
if (rootStore === undefined && props.handle === undefined) {
  throw new Error(
    'Vase UI: <Popover.Trigger> must be inside <Popover.Root>, or it must have a `handle`. Without a root the trigger has no popover to open. Put the trigger inside <Popover.Root>, or pass a `handle`.',
  );
}
// The store of a detached trigger changes when a root attaches to its handle.
const store = computed<PopoverHandleStore<any>>(() => handleStore.value ?? rootStore!);

const triggerId = useVaseUiId(() => props.id);
const isTriggerActive = computed(() => store.value.select('isTriggerActive', triggerId.value));
const isOpenedByThisTrigger = computed(() =>
  store.value.select('isOpenedByTrigger', triggerId.value),
);
const isPressOpenedByThisTrigger = computed(() =>
  store.value.select('isPressOpenedByTrigger', triggerId.value),
);
const popupId = computed(() => store.value.select('triggerPopupId', triggerId.value));
const isTouchPressOpen = computed(() => store.value.select('isTouchPressOpen', props.openOnHover));
const hasFocusGuards = computed(() => store.value.select('hasTriggerFocusGuards', triggerId.value));

const triggerElement = shallowRef<HTMLElement | null>(null);

const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
  triggerId,
  store,
  () => ({
    payload: props.payload,
    disabled: props.disabled,
    openOnHover: props.openOnHover,
    closeDelay: props.closeDelay,
  }),
);

// The handlers that one safe polygon makes share its timer, so each trigger has its own.
const handleClose = safePolygon();

const hoverProps = useHoverTriggerInteraction(store, {
  enabled: () => !props.disabled && props.openOnHover && !isTouchPressOpen.value,
  mouseOnly: true,
  move: false,
  handleClose: () => handleClose,
  restMs: () => props.delay,
  delay: () => ({ close: props.closeDelay }),
  triggerElement,
  isActiveTrigger: isTriggerActive,
});

const click = useClick(store, { stickIfOpen: () => store.value.context.stickIfOpen });
const interactionTypeProps = useOpenMethodTriggerProps(
  () => store.value.select('open'),
  (interactionType) => store.value.set('openMethod', interactionType),
);

const rootTriggerProps = computed(() =>
  store.value.select('triggerProps', isMountedByThisTrigger.value),
);

const { getButtonProps, buttonRef } = useButton({
  disabled: () => props.disabled,
  native: () => props.nativeButton,
});

const stateAttributesMapping: StateAttributesMapping<PopoverTriggerState> = {
  open(value) {
    return isPressOpenedByThisTrigger.value
      ? pressableTriggerOpenStateMapping.open(value)
      : triggerOpenStateMapping.open(value);
  },
};

const state = computed<PopoverTriggerState>(() => ({
  disabled: props.disabled,
  open: isOpenedByThisTrigger.value,
}));

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [
    buttonRef,
    registerTrigger,
    (trigger) => {
      triggerElement.value = trigger;
    },
  ],
  stateAttributesMapping,
  props: (attrs) => [
    click.reference,
    hoverProps,
    rootTriggerProps.value,
    interactionTypeProps,
    {
      [CLICK_TRIGGER_IDENTIFIER]: '',
      id: triggerId.value,
      'aria-haspopup': 'dialog' as const,
      'aria-expanded': isOpenedByThisTrigger.value,
      'aria-controls': popupId.value,
    },
    attrs,
    getButtonProps,
  ],
});

useTriggerFocusGuards(store, triggerElement, hasFocusGuards);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
