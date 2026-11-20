<script setup lang="ts">
import { useAttrs, type PropType } from 'vue';
import { useButton } from '../../src/common/button';
import { useElement } from '../../src/common/element';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  disabled: Boolean,
  own: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
});
const attrs = useAttrs();
const { element, setElement } = useElement();
const { mergeAttributes } = useButton({
  element,
  disabled: () => props.disabled,
  type: 'button',
});
</script>

<template>
  <slot name="element" :props="mergeAttributes(own, attrs)" :elementRef="setElement" />
</template>
