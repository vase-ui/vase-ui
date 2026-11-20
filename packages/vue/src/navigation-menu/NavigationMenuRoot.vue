<script setup lang="ts" generic="Value = unknown">
import { computed, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { useNavigationMenuRoot } from './root';
import type {
  NavigationMenuRootChangeEventDetails,
  NavigationMenuRootProps,
  NavigationMenuRootState,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuRootProps<Value>>(), {
  modelValue: undefined,
  defaultValue: null,
  delay: 50,
  closeDelay: 50,
  orientation: 'horizontal',
});
const emit = defineEmits<{
  /** The open item changes. `details.cancel()` keeps the menu as it was. */
  valueChange: [value: Value | null, details: NavigationMenuRootChangeEventDetails];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: Value | null];
}>();
defineSlots<{
  default?(scope: { state: NavigationMenuRootState }): unknown;
  element?(scope: ElementSlotProps<NavigationMenuRootState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { root, close } = useNavigationMenuRoot(
  props,
  emit as Parameters<typeof useNavigationMenuRoot>[1],
);
watch(element, (value) => root.setElement(value), { immediate: true, flush: 'sync' });

const state = computed<NavigationMenuRootState>(() => ({
  open: root.popup.open,
  nested: root.nested,
}));

function elementProps() {
  return { ...attrs };
}

defineExpose({ element, close });
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
  <div v-else-if="root.nested" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
  <nav v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </nav>
</template>
