<script setup lang="ts">
import { computed, mergeProps, useAttrs, useId, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { injectGroup } from './group';
import type { MenuGroupLabelProps, MenuGroupLabelState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<MenuGroupLabelProps>();
defineSlots<{
  default?(scope: { state: MenuGroupLabelState }): unknown;
  element?(scope: ElementSlotProps<MenuGroupLabelState>): unknown;
}>();

const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const group = injectGroup();
const labelId = computed(() => givenId(props.id) ?? generatedId);
const state = computed<MenuGroupLabelState>(() => ({}));
watch(labelId, (value, _, onCleanup) => onCleanup(group.setLabel(value)), { immediate: true });

function elementProps() {
  return mergeProps({ id: labelId.value, 'aria-hidden': 'true' }, attrs);
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
