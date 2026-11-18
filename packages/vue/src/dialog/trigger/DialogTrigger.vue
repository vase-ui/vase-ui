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
import { clickTriggers } from '../../utils/popups/registeredParts';
import { useElementRegistration } from '../../internals/useElementRegistration';
import { computed } from 'vue';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  useTriggerPress,
  useTriggerModality,
  usePopupTrigger,
  useTriggerOwner,
} from '../../utils/popups/usePopupTrigger';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useDialogRootContext } from '../root/DialogRootContext';
import type { DialogHandleStore } from '../store/DialogStore';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogTriggerProps<Payload>>(), {
  as: 'button',
  nativeButton: true,
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Dialog.Trigger');
}

defineSlots<{
  default(props: { state: DialogTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogTriggerState>;
}>();

const rootStore = useDialogRootContext(true);
const store = useTriggerOwner<DialogHandleStore<unknown>>(
  rootStore,
  () => props.handle,
  'Vase UI: <Dialog.Trigger> must be inside <Dialog.Root>. Without a root the trigger has no dialog to open. Put the trigger inside <Dialog.Root>, or pass a `handle`.',
);

const thisTriggerId = useVaseUiId(() => props.id);

const {
  registerTrigger,
  bindings: rootTriggerProps,
  open: popupOpen,
  isOpenedByThisTrigger,
  popupId,
} = usePopupTrigger(thisTriggerId, store, () => ({ payload: props.payload }));

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(() => props.disabled || (props.nativeButton && fieldsetDisabled.value));

const click = useTriggerPress(store);
const interactionTypeProps = useTriggerModality(popupOpen, (interactionType) => {
  store.value.set('openMethod', interactionType);
});

const state = computed<DialogTriggerState>(() => ({
  disabled: isDisabled.value,
  open: isOpenedByThisTrigger.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  DialogTriggerState,
  HTMLElement
>('button', props, {
  button: (element) =>
    useButton(element, {
      disabled: isDisabled,
      native: () => props.nativeButton,
    }),
  state,
  ref: registerTrigger,
  stateAttributesMapping: triggerOpenStateMapping,
  props: (attrs) => [
    click,
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
  ],
});

useElementRegistration(clickTriggers, element, () => true);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
