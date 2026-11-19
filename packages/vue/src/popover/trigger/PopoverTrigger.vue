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
import { selectors as popoverSelectors } from '../store/PopoverStore';
import { clickTriggers } from '../../utils/popups/registeredParts';
import { useElementRegistration } from '../../internals/useElementRegistration';
import { computed, shallowRef } from 'vue';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { usePopupTrigger, useTriggerOwner } from '../../utils/popups/usePopupTrigger';
import { useHoverPointerStyle } from '../../utils/popups/interactions/hoverPointerEvents';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import {
  pressableTriggerOpenStateMapping,
  triggerOpenStateMapping,
} from '../../utils/popups/popupStateMapping';
import { useTriggerFocusGuards } from '../../utils/popups/useTriggerFocusGuards';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import type { PopoverHandleStore } from '../store/PopoverStore';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverTriggerProps<Payload>>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
  openOnHover: false,
  delay: 300,
  closeDelay: 0,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Popover.Trigger');
}

defineSlots<{
  default(props: { state: PopoverTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverTriggerState>;
}>();

const rootStore = usePopoverRootContext(true);
const store = useTriggerOwner<PopoverHandleStore<unknown>>(
  rootStore,
  () => props.handle,
  'Vase UI: <Popover.Trigger> must be inside <Popover.Root>, or it must have a `handle`. Without a root the trigger has no popover to open. Put the trigger inside <Popover.Root>, or pass a `handle`.',
);

const triggerId = useVaseUiId(() => props.id);
const isPressOpenedByThisTrigger = computed(() =>
  popoverSelectors.isPressOpenedByTrigger(store.value.state, triggerId.value),
);
const isTouchPressOpen = computed(() =>
  popoverSelectors.isTouchPressOpen(store.value.state, props.openOnHover),
);
const hasFocusGuards = computed(() =>
  popoverSelectors.hasTriggerFocusGuards(store.value.state, triggerId.value),
);

const triggerElement = shallowRef<HTMLElement | null>(null);
const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(() => props.disabled || (props.nativeButton && fieldsetDisabled.value));

const {
  registerTrigger,
  useModality,
  usePress,
  bindings: rootTriggerProps,
  isOpenedByThisTrigger,
  isTriggerActive,
  popupId,
} = usePopupTrigger(triggerId, store, () => ({
  payload: props.payload,
  disabled: isDisabled.value,
  openOnHover: props.openOnHover,
  closeDelay: props.closeDelay,
}));

// The handlers that one safe polygon makes share its timer, so each trigger has its own.
const handleClose = safePolygon();

const hoverStyle = useHoverPointerStyle(triggerElement);
const hoverProps = useHoverTriggerInteraction(store, {
  enabled: () => !isDisabled.value && props.openOnHover && !isTouchPressOpen.value,
  mouseOnly: true,
  move: false,
  handleClose: () => handleClose,
  restMs: () => props.delay,
  delay: () => ({ close: props.closeDelay }),
  triggerElement,
  isActiveTrigger: isTriggerActive,
});

const click = usePress({ stickIfOpen: () => store.value.context.stickIfOpen });
const interactionTypeProps = useModality((interactionType) =>
  store.value.set('openMethod', interactionType),
);

const stateAttributesMapping: StateAttributesMapping<PopoverTriggerState> = {
  open(value) {
    return isPressOpenedByThisTrigger.value
      ? pressableTriggerOpenStateMapping.open(value)
      : triggerOpenStateMapping.open(value);
  },
};

const state = computed<PopoverTriggerState>(() => ({
  disabled: isDisabled.value,
  open: isOpenedByThisTrigger.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  elementRef: triggerElement,
  button: (element) =>
    useButton(element, {
      disabled: isDisabled,
      native: () => props.nativeButton,
    }),
  state,
  ref: registerTrigger,
  stateAttributesMapping,
  props: (attrs) => [
    click,
    hoverProps,
    { style: hoverStyle.value },
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
  ],
});

useTriggerFocusGuards(store, triggerElement, hasFocusGuards);

useElementRegistration(clickTriggers, element, () => true);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
