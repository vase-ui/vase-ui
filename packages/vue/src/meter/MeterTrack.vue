<script setup lang="ts">
import { useAttrs, type HTMLAttributes } from 'vue';
import { useElement, type AsProps } from '../common/element';

defineOptions({ inheritAttrs: false });

defineProps<AsProps & /* @vue-ignore */ Omit<HTMLAttributes, 'as'>>();
defineSlots<{
  default?(): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.element" name="element" :props="attrs" :elementRef="setElement" />
  <component :is="as" v-else-if="as" v-bind="attrs" :ref="setElement">
    <slot />
  </component>
  <div v-else v-bind="attrs" :ref="setElement">
    <slot />
  </div>
</template>
