<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId, watch } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectMenu } from './root';
import type { MenuListProps, MenuListState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<MenuListProps>();
defineSlots<{
  default?(scope: { state: MenuListState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenuListState;
  }): unknown;
}>();

const menu = injectMenu('List');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<MenuListState>(() => ({}));

watch(element, (list) => (menu.listElement.value = list), { flush: 'sync' });
onUnmounted(() => {
  if (menu.listElement.value === element.value) menu.listElement.value = null;
});

function elementProps() {
  const named = 'aria-label' in attrs || 'aria-labelledby' in attrs;
  return mergeProps(
    {
      id: givenId(props.id) ?? generatedId,
      role: 'menu',
      tabindex: -1,
      'aria-labelledby': named ? undefined : menu.root.activeTrigger?.id || undefined,
      'aria-orientation': menu.orientation === 'horizontal' ? 'horizontal' : undefined,
    },
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
