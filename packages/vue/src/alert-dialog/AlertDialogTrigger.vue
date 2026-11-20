<script setup lang="ts" generic="Payload = unknown">
import { useDialogTrigger } from '../dialog/root';
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

const { element, setElement, state, elementProps } = useDialogTrigger('AlertDialog', props);

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
