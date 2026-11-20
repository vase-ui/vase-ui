<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectGroup } from './group';
import type { MenuGroupLabelProps, MenuGroupLabelState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<MenuGroupLabelProps>();
defineSlots<{
  default?(scope: { state: MenuGroupLabelState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: MenuGroupLabelState;
  }): unknown;
}>();

const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const group = injectGroup();
const id = computed(() => givenId(props.id) ?? generatedId);
const state = computed<MenuGroupLabelState>(() => ({}));
const removeLabel = group.setLabel(id.value);
onUnmounted(removeLabel);

function elementProps() {
  return mergeProps({ id: id.value, 'aria-hidden': 'true' }, attrs);
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
