<script setup lang="ts" generic="Payload = unknown">
import { useDialogTrigger } from './root';
import type { DialogTriggerProps, DialogTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogTriggerProps<Payload>>(), { disabled: false });
defineSlots<{
  default?(scope: { state: DialogTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DialogTriggerState;
  }): unknown;
}>();

const { element, setElement, state, elementProps } = useDialogTrigger('Dialog', props);

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
