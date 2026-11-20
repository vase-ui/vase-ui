<script setup lang="ts" generic="Payload = unknown">
import { useDialogTrigger } from '../dialog/root';
import type { DrawerTriggerProps, DrawerTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DrawerTriggerProps<Payload>>(), { disabled: false });
defineSlots<{
  default?(scope: { state: DrawerTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DrawerTriggerState;
  }): unknown;
}>();

const { element, setElement, state, elementProps } = useDialogTrigger('Drawer', props);

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
