<script setup lang="ts" generic="Payload = unknown">
import { computed, mergeProps, useAttrs, useId } from 'vue';
import { useAsTag, useElement } from '../common/element';
import { givenId } from '../common/id';
import { usePopupTrigger } from '../popup/trigger';
import { useTriggerDialog, type DialogHandle } from '../dialog/root';
import type { AlertDialogTriggerProps, AlertDialogTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AlertDialogTriggerProps<Payload>>(), { disabled: false });
defineSlots<{
  default?(scope: { state: AlertDialogTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: AlertDialogTriggerState;
  }): unknown;
}>();

const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const context = useTriggerDialog('AlertDialog', () => props.handle as DialogHandle | undefined);
const root = () => context.value?.root ?? null;
const elementId = computed(() => givenId(props.id) ?? generatedId);

const trigger = usePopupTrigger(root, {
  element,
  id: () => elementId.value,
  payload: () => props.payload,
  disabled: () => props.disabled,
  tag: useAsTag(() => props.as),
});

const state = computed<AlertDialogTriggerState>(() => ({
  open: trigger.open.value,
  disabled: trigger.button.disabled.value,
}));

function elementProps() {
  const popup = root()?.popup;
  return trigger.button.mergeAttributes(
    mergeProps({
      id: elementId.value,
      'aria-haspopup': 'dialog',
      'aria-expanded': trigger.open.value ? 'true' : 'false',
      'aria-controls': trigger.open.value && popup ? popup.id : undefined,
      onClick: trigger.onClick,
      onKeydown: (event: KeyboardEvent) => {
        if (trigger.open.value) context.value?.focus.onTriggerKeydown(event);
      },
    }),
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
