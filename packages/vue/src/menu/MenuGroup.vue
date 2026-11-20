<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { useGroupItems } from './filter';
import { useGroupLabel } from './group';
import type { MenuGroupProps, MenuGroupState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<MenuGroupProps>();
defineSlots<{
  default?(scope: { state: MenuGroupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenuGroupState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const labelId = useGroupLabel();
const shown = useGroupItems();
const state = computed<MenuGroupState>(() => ({}));

function elementProps() {
  return mergeProps(
    { role: 'group', 'aria-labelledby': labelId.value, hidden: shown.value ? undefined : true },
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
