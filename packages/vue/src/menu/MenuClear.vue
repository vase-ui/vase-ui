<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { injectFilter } from './filter';
import { injectMenu } from './root';
import type { MenuClearProps, MenuClearState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuClearProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: MenuClearState }): unknown;
  element?(scope: ElementSlotProps<MenuClearState>): unknown;
}>();

const filter = injectFilter(injectMenu('Clear'), 'Clear');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const button = useButton({
  element,
  disabled: () => props.disabled,
  type: 'button',
  tag: useAsTag(() => props.as),
});
const shown = computed(() => filter.query !== '');
const state = computed<MenuClearState>(() => ({ disabled: button.disabled.value }));

function onClick(event: MouseEvent) {
  filter.setQuery('', 'clear-press', event);
  filter.input.value?.focus();
}

function elementProps() {
  return button.mergeAttributes({ tabindex: -1, 'aria-hidden': 'true', onClick }, attrs);
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="shown && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <button v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
