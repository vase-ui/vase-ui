<script setup lang="ts">
import { computed, provide, shallowRef, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { avatarKey } from './root';
import type { AvatarRootProps, AvatarRootState, ImageLoadingStatus } from './types';

defineOptions({ inheritAttrs: false });

defineProps<AvatarRootProps>();
defineSlots<{
  default?(scope: { state: AvatarRootState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: AvatarRootState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLSpanElement>();
const status = shallowRef<ImageLoadingStatus>('idle');
const state = computed<AvatarRootState>(() => ({ imageLoadingStatus: status.value }));

provide(avatarKey, {
  get state() {
    return state.value;
  },
  setStatus(value) {
    status.value = value;
  },
});

defineExpose({ element });

function elementProps() {
  return { ...attrs };
}
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
  <span v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </span>
</template>
