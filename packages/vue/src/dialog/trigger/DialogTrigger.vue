<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { DialogHandle } from '../store/DialogHandle';

export interface DialogTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the dialog is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface DialogTriggerProps<Payload = unknown>
  extends
    NativeButtonProps,
    VaseUIComponentProps<DialogTriggerState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<ButtonHTMLAttributes, 'id' | 'disabled'>> {
  /**
   * A handle to associate the trigger with a dialog.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * A payload to pass to the dialog when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the dialog in controlled mode (with the DialogRoot `triggerId` prop).
   */
  id?: string | undefined;
  /**
   * Whether the trigger should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts" generic="Payload = unknown">
import { computed } from 'vue';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useOpenMethodTriggerProps } from '../../utils/popups/interactions/useOpenInteractionType';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
import { useDialogRootContext } from '../root/DialogRootContext';
import type { DialogHandleStore } from '../store/DialogStore';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogTriggerProps<Payload>>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

defineSlots<{
  default(props: { state: DialogTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogTriggerState>;
}>();

const rootStore = useDialogRootContext(true);
const handleStore = usePopupHandleStore(() => props.handle);
if (rootStore === undefined && props.handle === undefined) {
  throw new Error(
    'Vase UI: <Dialog.Trigger> must be inside <Dialog.Root>, or it must have a `handle`. Without a root the trigger has no dialog to open. Put the trigger inside <Dialog.Root>, or pass a `handle`.',
  );
}
const store = computed<DialogHandleStore<any>>(() => handleStore.value ?? rootStore!);

const thisTriggerId = useVaseUiId(() => props.id);
const isOpenedByThisTrigger = computed(() =>
  store.value.select('isOpenedByTrigger', thisTriggerId.value),
);
const popupId = computed(() => store.value.select('triggerPopupId', thisTriggerId.value));

const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
  thisTriggerId,
  store,
  () => ({ payload: props.payload }),
);

const { getButtonProps, buttonRef } = useButton({
  disabled: () => props.disabled,
  native: () => props.nativeButton,
});

const click = useClick(store);
const interactionTypeProps = useOpenMethodTriggerProps(
  () => store.value.select('open'),
  (interactionType) => {
    store.value.set('openMethod', interactionType);
  },
);

const state = computed<DialogTriggerState>(() => ({
  disabled: props.disabled,
  open: isOpenedByThisTrigger.value,
}));

const rootTriggerProps = computed(() =>
  store.value.select('triggerProps', isMountedByThisTrigger.value),
);

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [buttonRef, registerTrigger],
  stateAttributesMapping: triggerOpenStateMapping,
  props: (attrs) => [
    click.reference,
    rootTriggerProps.value,
    interactionTypeProps,
    {
      [CLICK_TRIGGER_IDENTIFIER]: '',
      id: thisTriggerId.value,
      'aria-haspopup': 'dialog',
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
