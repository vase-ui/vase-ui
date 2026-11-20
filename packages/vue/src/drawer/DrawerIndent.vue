<script setup lang="ts">
import { computed, inject, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { providerKey } from './root';
import type { DrawerIndentProps, DrawerIndentState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<DrawerIndentProps>();
defineSlots<{
  default?(scope: { state: DrawerIndentState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DrawerIndentState;
  }): unknown;
}>();

const provider = inject(providerKey, null);
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<DrawerIndentState>(() => ({ active: !!provider?.active }));

function elementProps() {
  const progress = provider?.progress ?? 0;
  const height = provider?.height ?? 0;
  return mergeProps(
    {
      'data-active': state.value.active ? '' : undefined,
      style: {
        '--drawer-swipe-progress': progress,
        '--drawer-height': height > 0 ? `${height}px` : undefined,
      },
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
