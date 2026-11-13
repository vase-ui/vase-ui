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
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useOpenMethodTriggerProps } from '../../utils/popups/interactions/useOpenInteractionType';
import {
  pressableTriggerOpenStateMapping,
  triggerOpenStateMapping,
} from '../../utils/popups/popupStateMapping';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import type { PopoverHandleStore } from '../store/PopoverStore';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverTriggerProps>(), {
  as: 'button',
  disabled: false,
  nativeButton: true,
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
const isOpenedByThisTrigger = computed(() =>
  store.value.select('isOpenedByTrigger', triggerId.value),
);
const isPressOpenedByThisTrigger = computed(() =>
  store.value.select('isPressOpenedByTrigger', triggerId.value),
);
const popupId = computed(() => store.value.select('triggerPopupId', triggerId.value));

const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
  triggerId,
  store,
  () => ({ payload: props.payload, disabled: props.disabled }),
);

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
  ref: [buttonRef, registerTrigger],
  stateAttributesMapping,
  props: (attrs) => [
    click.reference,
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

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
